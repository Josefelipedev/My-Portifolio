'use client';

// Company-first jobs view: browse the tracked PT companies, then drill into a
// single company's openings ranked by how well they match your resume. The
// "Gerir / seguir empresa" toggle reveals the existing portal manager
// (CompanyTracker) so you can follow new companies or run a scan from here.

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api-fetch';
import { fetchWithCSRF } from '@/lib/csrf-client';
import CompanyTracker from './CompanyTracker';

interface CompanyRow {
  company: string;
  count: number;
  topMatch: number;
  graded: number;
  withCv: number;
  portalType: string | null;
  isActive: boolean | null;
  lastScannedAt: string | null;
}

interface CompanyJob {
  id: string;
  title: string;
  company: string;
  url: string;
  location?: string | null;
  jobType?: string | null;
  aiGrade?: string | null;
  generatedCvAt?: string | null;
  matchPercent: number;
  application?: { id: string; status: string } | null;
}

const GRADE_COLOR: Record<string, string> = {
  A: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  B: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400',
  C: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  D: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  F: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const PORTAL_LABEL: Record<string, string> = {
  greenhouse: 'Greenhouse',
  ashby: 'Ashby',
  lever: 'Lever',
  smartrecruiters: 'SmartRecruiters',
  recruitee: 'Recruitee',
  custom: 'Custom',
};

function matchColor(p: number): string {
  if (p >= 50) return 'text-green-600 dark:text-green-400';
  if (p >= 30) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-zinc-400 dark:text-zinc-500';
}

export default function CompaniesBoard() {
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [jobs, setJobs] = useState<CompanyJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [manage, setManage] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoverMsg, setDiscoverMsg] = useState<string | null>(null);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/jobs/companies');
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Run the discovery agent: find PT IT consultancies + validate their jobs.
  const runDiscover = async () => {
    setDiscovering(true);
    setDiscoverMsg(null);
    try {
      const res = await fetchWithCSRF('/api/jobs/companies/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 15 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'falhou');
      const added = data.added?.length ?? 0;
      const totalJobs = (data.added ?? []).reduce((n: number, a: { jobs: number }) => n + (a.jobs || 0), 0);
      setDiscoverMsg(
        added > 0
          ? `Encontradas ${added} consultoria(s) com ${totalJobs} vaga(s). Vão ser varridas no próximo scan.`
          : `Nenhuma consultoria nova validada (${data.error || 'sem candidatos'}).`
      );
      await loadCompanies();
    } catch (e) {
      setDiscoverMsg(`Erro: ${e instanceof Error ? e.message : 'desconhecido'}`);
    } finally {
      setDiscovering(false);
    }
  };

  const openCompany = async (name: string) => {
    setSelected(name);
    setJobsLoading(true);
    try {
      const res = await apiFetch(`/api/jobs/companies/${encodeURIComponent(name)}/jobs`);
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch {
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  };

  // ── Drill-down: a single company's ranked jobs ──
  if (selected) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1"
        >
          ← Empresas
        </button>
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{selected}</h2>
          <span className="text-sm text-zinc-500">{jobs.length} vaga(s) · ordenadas pelo teu match</span>
        </div>

        {jobsLoading ? (
          <p className="text-zinc-500 py-8 text-center">A carregar vagas…</p>
        ) : jobs.length === 0 ? (
          <p className="text-zinc-500 py-8 text-center">Sem vagas guardadas para esta empresa.</p>
        ) : (
          <ul className="space-y-2">
            {jobs.map((j) => (
              <li
                key={j.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
              >
                <span className={`font-bold tabular-nums w-12 text-right ${matchColor(j.matchPercent)}`}>
                  {j.matchPercent}%
                </span>
                {j.aiGrade && (
                  <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${GRADE_COLOR[j.aiGrade] || ''}`}>
                    {j.aiGrade}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <a
                    href={j.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-red-600 dark:hover:text-red-400 truncate block"
                  >
                    {j.title}
                  </a>
                  <span className="text-xs text-zinc-500">
                    {j.location || '—'}
                    {j.jobType ? ` · ${j.jobType}` : ''}
                    {j.generatedCvAt ? ' · CV gerado' : ''}
                    {j.application ? ` · ${j.application.status}` : ''}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ── Companies grid ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Empresas</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={runDiscover}
            disabled={discovering}
            className="text-sm px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Agente: procura consultorias PT e valida as vagas delas"
          >
            {discovering ? 'A descobrir…' : '🔍 Descobrir consultorias'}
          </button>
          <button
            onClick={() => setManage((m) => !m)}
            className="text-sm px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
          >
            {manage ? 'Fechar gestão' : '+ Seguir / gerir'}
          </button>
        </div>
      </div>

      {discoverMsg && (
        <p className="text-sm rounded-lg px-3 py-2 bg-zinc-100 dark:bg-zinc-700/50 text-zinc-700 dark:text-zinc-300">
          {discoverMsg}
        </p>
      )}

      {manage && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3">
          <CompanyTracker />
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500 py-8 text-center">A carregar empresas…</p>
      ) : rows.length === 0 ? (
        <p className="text-zinc-500 py-8 text-center">
          Sem empresas ainda. Usa &quot;Seguir / gerir empresas&quot; para adicionar consultorias PT.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <button
              key={r.company}
              onClick={() => openCompany(r.company)}
              className="text-left p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-red-400 dark:hover:border-red-500/60 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{r.company}</h3>
                {r.portalType && (
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                    {PORTAL_LABEL[r.portalType] || r.portalType}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3 text-sm">
                <span className="text-zinc-900 dark:text-zinc-100 font-bold">{r.count}</span>
                <span className="text-zinc-500">vaga(s)</span>
                <span className={`ml-auto font-bold ${matchColor(r.topMatch)}`}>{r.topMatch}% top</span>
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                {r.graded} graduada(s) · {r.withCv} c/ CV
                {r.isActive === false ? ' · inativa' : ''}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
