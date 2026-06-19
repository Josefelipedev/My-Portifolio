'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-fetch';
import { useToast } from '@/components/ui/Toast';

interface JobApplication {
  id: string;
  title: string;
  company: string;
  url?: string;
  status: string;
  appliedAt?: string;
  nextStep?: string;
  nextStepDate?: string;
  emailSentAt?: string;
  savedJob?: { companyLogo?: string | null } | null;
}

const COLUMNS: { id: string; label: string; head: string }[] = [
  { id: 'saved', label: 'Saved', head: 'text-zinc-600 dark:text-zinc-300' },
  { id: 'applied', label: 'Applied', head: 'text-blue-600 dark:text-blue-400' },
  { id: 'interview', label: 'Interview', head: 'text-yellow-600 dark:text-yellow-400' },
  { id: 'offer', label: 'Offer', head: 'text-green-600 dark:text-green-400' },
  { id: 'rejected', label: 'Rejected', head: 'text-red-600 dark:text-red-400' },
];

type DueState = 'none' | 'overdue' | 'soon' | 'later';

function dueState(d?: string): DueState {
  if (!d) return 'none';
  const date = new Date(d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = (date.getTime() - today.getTime()) / 86_400_000;
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 7) return 'soon';
  return 'later';
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const dueBadge: Record<DueState, string> = {
  overdue: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  soon: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
  later: 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500',
  none: '',
};

export default function JobPipelineBoard() {
  const { showError } = useToast();
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const res = await apiFetch('/api/jobs/applications');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load applications');
      setApps(data);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }

  async function moveTo(id: string, status: string) {
    const app = apps.find((a) => a.id === id);
    if (!app || app.status === status) return;

    const prev = apps;
    setApps((list) => list.map((a) => (a.id === id ? { ...a, status } : a))); // optimistic
    try {
      const res = await apiFetch(`/api/jobs/applications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, statusNote: `Movido para ${status} no pipeline` }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update status');
      }
    } catch (e) {
      setApps(prev); // revert
      showError(e instanceof Error ? e.message : 'Failed to update status');
    }
  }

  const followups = apps
    .filter((a) => a.nextStepDate && a.status !== 'rejected')
    .map((a) => ({ app: a, state: dueState(a.nextStepDate) }))
    .filter((x) => x.state === 'overdue' || x.state === 'soon')
    .sort((a, b) => new Date(a.app.nextStepDate!).getTime() - new Date(b.app.nextStepDate!).getTime());

  const overdueCount = followups.filter((f) => f.state === 'overdue').length;
  const soonCount = followups.filter((f) => f.state === 'soon').length;

  if (loading) {
    return <p className="text-sm text-zinc-500 py-8 text-center">Carregando pipeline…</p>;
  }

  return (
    <div>
      {/* Follow-up reminders */}
      {followups.length > 0 && (
        <div className="mb-5 p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <p className="font-medium text-amber-800 dark:text-amber-300 mb-2">
            🔔 Follow-ups: {overdueCount > 0 && <span className="text-red-600 dark:text-red-400">{overdueCount} atrasado(s)</span>}
            {overdueCount > 0 && soonCount > 0 && ' · '}
            {soonCount > 0 && <span>{soonCount} nos próximos 7 dias</span>}
          </p>
          <ul className="space-y-1">
            {followups.slice(0, 6).map(({ app, state }) => (
              <li key={app.id} className="text-sm flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded ${dueBadge[state]}`}>
                  {fmtDate(app.nextStepDate!)}
                </span>
                <span className="text-zinc-700 dark:text-zinc-300">
                  {app.nextStep || 'Follow-up'} — <strong>{app.title}</strong> @ {app.company}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Kanban board */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {COLUMNS.map((col) => {
          const colApps = apps.filter((a) => a.status === col.id);
          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(col.id);
              }}
              onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
              onDrop={() => {
                if (dragId) moveTo(dragId, col.id);
                setDragId(null);
                setOverCol(null);
              }}
              className={`rounded-xl border p-2 min-h-[120px] transition-colors ${
                overCol === col.id
                  ? 'border-red-400 bg-red-50/50 dark:bg-red-900/10'
                  : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30'
              }`}
            >
              <div className={`flex items-center justify-between px-1 mb-2 text-sm font-semibold ${col.head}`}>
                <span>{col.label}</span>
                <span className="px-1.5 py-0.5 bg-white dark:bg-zinc-700 rounded text-xs text-zinc-500">
                  {colApps.length}
                </span>
              </div>

              <div className="space-y-2">
                {colApps.map((app) => {
                  const state = dueState(app.nextStepDate);
                  return (
                    <div
                      key={app.id}
                      draggable
                      onDragStart={(e) => {
                        setDragId(app.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverCol(null);
                      }}
                      className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-2.5 cursor-grab active:cursor-grabbing hover:shadow-sm"
                    >
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2">
                        {app.title}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">{app.company}</p>
                      {app.emailSentAt && (
                        <span
                          className="inline-block mt-1.5 mr-1 text-xs text-green-600 dark:text-green-400"
                          title={`Candidatura enviada em ${fmtDate(app.emailSentAt)}`}
                        >
                          ✉ enviado {fmtDate(app.emailSentAt)}
                        </span>
                      )}
                      {app.nextStepDate && state !== 'none' && (
                        <span className={`inline-block mt-1.5 text-xs px-1.5 py-0.5 rounded ${dueBadge[state]}`}>
                          {state === 'overdue' ? '⚠ ' : '📅 '}
                          {app.nextStep ? `${app.nextStep} · ` : ''}
                          {fmtDate(app.nextStepDate)}
                        </span>
                      )}
                    </div>
                  );
                })}
                {colApps.length === 0 && (
                  <p className="text-xs text-zinc-400 text-center py-3">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-zinc-500 mt-3">
        Arraste os cartões entre as colunas para atualizar o status. Lembretes de follow-up usam a data de
        próximo passo de cada candidatura.
      </p>
    </div>
  );
}
