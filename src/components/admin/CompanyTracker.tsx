'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/Toast';

interface CompanyPortal {
  id: string;
  company: string;
  careersUrl: string;
  portalType: string;
  portalSlug: string | null;
  titleFilters: string | null;
  isActive: boolean;
  lastScannedAt: string | null;
  lastMatchCount: number;
  createdAt: string;
}

interface TitleFilters {
  include: string[];
  exclude: string[];
}

interface ScanResult {
  company: string;
  portalType: string;
  totalFound: number;
  newJobs: number;
  jobTitles: string[];
  errors: string[];
}

interface ScanSummary {
  companiesScanned: number;
  totalJobsFound: number;
  newJobsFound: number;
  errors: string[];
}

const PORTAL_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  greenhouse: { label: 'Greenhouse', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  ashby: { label: 'Ashby', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  lever: { label: 'Lever', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  custom: { label: 'Custom', color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300' },
};

const EMPTY_FILTERS: TitleFilters = { include: [], exclude: [] };

export default function CompanyTracker() {
  const { showSuccess, showError } = useToast();
  const [portals, setPortals] = useState<CompanyPortal[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<{ summary: ScanSummary; results: ScanResult[] } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newPortal, setNewPortal] = useState({
    company: '',
    careersUrl: '',
    includeKeywords: '',
    excludeKeywords: '',
  });

  useEffect(() => {
    fetchPortals();
  }, []);

  const fetchPortals = async () => {
    try {
      const res = await fetch('/api/jobs/portals');
      const data = await res.json();
      setPortals(Array.isArray(data) ? data : []);
    } catch {
      showError('Failed to load portals');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newPortal.company || !newPortal.careersUrl) {
      showError('Company name and careers URL are required');
      return;
    }

    const titleFilters: TitleFilters = {
      include: newPortal.includeKeywords.split(',').map((k) => k.trim()).filter(Boolean),
      exclude: newPortal.excludeKeywords.split(',').map((k) => k.trim()).filter(Boolean),
    };

    try {
      const res = await fetch('/api/jobs/portals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: newPortal.company,
          careersUrl: newPortal.careersUrl,
          titleFilters,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add portal');
      }

      await fetchPortals();
      setNewPortal({ company: '', careersUrl: '', includeKeywords: '', excludeKeywords: '' });
      setShowAddForm(false);
      showSuccess('Empresa adicionada!');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to add portal');
    }
  };

  const handleToggleActive = async (portal: CompanyPortal) => {
    try {
      await fetch(`/api/jobs/portals/${portal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !portal.isActive }),
      });
      setPortals((prev) =>
        prev.map((p) => (p.id === portal.id ? { ...p, isActive: !p.isActive } : p))
      );
    } catch {
      showError('Failed to update portal');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta empresa do tracker?')) return;
    try {
      await fetch(`/api/jobs/portals/${id}`, { method: 'DELETE' });
      setPortals((prev) => prev.filter((p) => p.id !== id));
      showSuccess('Empresa removida');
    } catch {
      showError('Failed to delete portal');
    }
  };

  const handleScanAll = async () => {
    setScanning(true);
    setScanResults(null);
    try {
      const res = await fetch('/api/jobs/portals/scan', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Scan failed');

      setScanResults({ summary: data.summary, results: data.results });
      await fetchPortals();

      if (data.summary.newJobsFound > 0) {
        showSuccess(`Scan concluído! ${data.summary.newJobsFound} novas vagas encontradas.`);
      } else {
        showSuccess('Scan concluído. Nenhuma vaga nova.');
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const getFilters = (portal: CompanyPortal): TitleFilters => {
    if (!portal.titleFilters) return EMPTY_FILTERS;
    try {
      return JSON.parse(portal.titleFilters) as TitleFilters;
    } catch {
      return EMPTY_FILTERS;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-500">
        <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading portals...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Company Tracker</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Monitora vagas diretamente nas páginas de carreiras (Greenhouse, Ashby, Lever)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleScanAll}
            disabled={scanning || portals.filter((p) => p.isActive).length === 0}
            className="px-4 py-2 text-sm font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {scanning ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Scanning...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Scan All
              </>
            )}
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Adicionar Empresa
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 space-y-4">
          <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Nova Empresa</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Nome da Empresa *</label>
              <input
                type="text"
                value={newPortal.company}
                onChange={(e) => setNewPortal({ ...newPortal, company: e.target.value })}
                placeholder="Ex: Stripe, Cloudflare"
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">URL de Carreiras *</label>
              <input
                type="url"
                value={newPortal.careersUrl}
                onChange={(e) => setNewPortal({ ...newPortal, careersUrl: e.target.value })}
                placeholder="https://boards.greenhouse.io/stripe"
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Filtrar por título (incluir) <span className="text-zinc-400">— separados por vírgula</span>
              </label>
              <input
                type="text"
                value={newPortal.includeKeywords}
                onChange={(e) => setNewPortal({ ...newPortal, includeKeywords: e.target.value })}
                placeholder="developer, engineer, backend"
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Filtrar por título (excluir) <span className="text-zinc-400">— separados por vírgula</span>
              </label>
              <input
                type="text"
                value={newPortal.excludeKeywords}
                onChange={(e) => setNewPortal({ ...newPortal, excludeKeywords: e.target.value })}
                placeholder="manager, director, intern"
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleAdd}
              className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Adicionar
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Scan Results */}
      {scanResults && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Resultados do Scan</h4>
            <button
              onClick={() => setScanResults(null)}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Fechar
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/60 dark:bg-zinc-800/60 rounded-lg p-2">
              <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{scanResults.summary.companiesScanned}</p>
              <p className="text-xs text-zinc-500">Empresas</p>
            </div>
            <div className="bg-white/60 dark:bg-zinc-800/60 rounded-lg p-2">
              <p className="text-lg font-bold text-zinc-700 dark:text-zinc-300">{scanResults.summary.totalJobsFound}</p>
              <p className="text-xs text-zinc-500">Vagas encontradas</p>
            </div>
            <div className="bg-white/60 dark:bg-zinc-800/60 rounded-lg p-2">
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{scanResults.summary.newJobsFound}</p>
              <p className="text-xs text-zinc-500">Novas vagas</p>
            </div>
          </div>
          {scanResults.results.some((r) => r.newJobs > 0) && (
            <div className="space-y-2">
              {scanResults.results.filter((r) => r.newJobs > 0).map((r, i) => (
                <div key={i} className="bg-white/60 dark:bg-zinc-800/60 rounded-lg p-2">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{r.company} — {r.newJobs} nova(s)</p>
                  <ul className="mt-1 space-y-0.5">
                    {r.jobTitles.map((t, j) => (
                      <li key={j} className="text-xs text-zinc-500">· {t}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {scanResults.summary.errors.length > 0 && (
            <div className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
              {scanResults.summary.errors.map((e, i) => <p key={i}>⚠ {e}</p>)}
            </div>
          )}
        </div>
      )}

      {/* Portals List */}
      {portals.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-sm">Nenhuma empresa adicionada ainda.</p>
          <p className="text-xs mt-1">Adicione empresas com Greenhouse, Ashby ou Lever para monitorar vagas automaticamente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {portals.map((portal) => {
            const config = PORTAL_TYPE_CONFIG[portal.portalType] || PORTAL_TYPE_CONFIG.custom;
            const filters = getFilters(portal);
            const isEditing = editingId === portal.id;

            return (
              <div
                key={portal.id}
                className={`bg-white dark:bg-zinc-800 border rounded-xl overflow-hidden transition-opacity ${
                  portal.isActive ? 'border-zinc-200 dark:border-zinc-700' : 'border-zinc-100 dark:border-zinc-800 opacity-60'
                }`}
              >
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-zinc-500">{portal.company.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm truncate">{portal.company}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        {!portal.portalSlug && portal.portalType !== 'custom' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                            Slug não detectado
                          </span>
                        )}
                      </div>
                      <a
                        href={portal.careersUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 truncate block max-w-xs"
                      >
                        {portal.careersUrl}
                      </a>
                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                        <span>Último scan: {formatDate(portal.lastScannedAt)}</span>
                        {portal.lastScannedAt && (
                          <span className="text-green-600 dark:text-green-400">{portal.lastMatchCount} nova(s)</span>
                        )}
                        {(filters.include.length > 0 || filters.exclude.length > 0) && (
                          <span className="text-indigo-500">Filtros ativos</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Active toggle */}
                    <button
                      onClick={() => handleToggleActive(portal)}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
                        portal.isActive ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                      }`}
                      title={portal.isActive ? 'Desativar' : 'Ativar'}
                    >
                      <span
                        className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transform transition-transform ${
                          portal.isActive ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>

                    <button
                      onClick={() => setEditingId(isEditing ? null : portal.id)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      title="Editar filtros"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => handleDelete(portal.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Remover"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Inline Edit */}
                {isEditing && (
                  <EditPortalInline
                    portal={portal}
                    onSave={async (updated) => {
                      await fetch(`/api/jobs/portals/${portal.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updated),
                      });
                      await fetchPortals();
                      setEditingId(null);
                      showSuccess('Portal atualizado');
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EditPortalInline({
  portal,
  onSave,
  onCancel,
}: {
  portal: CompanyPortal;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const getFilters = (): TitleFilters => {
    if (!portal.titleFilters) return { include: [], exclude: [] };
    try {
      return JSON.parse(portal.titleFilters) as TitleFilters;
    } catch {
      return { include: [], exclude: [] };
    }
  };

  const existing = getFilters();
  const [include, setInclude] = useState(existing.include.join(', '));
  const [exclude, setExclude] = useState(existing.exclude.join(', '));
  const [slug, setSlug] = useState(portal.portalSlug || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        portalSlug: slug || null,
        titleFilters: {
          include: include.split(',').map((k) => k.trim()).filter(Boolean),
          exclude: exclude.split(',').map((k) => k.trim()).filter(Boolean),
        },
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-700 p-4 bg-zinc-50 dark:bg-zinc-800/50 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            Portal Slug <span className="text-zinc-400">({portal.portalType})</span>
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="company-slug"
            className="w-full px-2 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Incluir (títulos)</label>
          <input
            type="text"
            value={include}
            onChange={(e) => setInclude(e.target.value)}
            placeholder="developer, engineer"
            className="w-full px-2 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Excluir (títulos)</label>
          <input
            type="text"
            value={exclude}
            onChange={(e) => setExclude(e.target.value)}
            placeholder="manager, intern"
            className="w-full px-2 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
