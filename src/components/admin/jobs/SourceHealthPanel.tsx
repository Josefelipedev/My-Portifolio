'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-fetch';
import { useToast } from '@/components/ui/Toast';

interface SourceHealth {
  source: string;
  ok: boolean;
  count: number;
  error?: string;
  latencyMs: number;
}

interface HealthResponse {
  probedAt: string;
  query: { keyword: string; country: string };
  sources: SourceHealth[];
  apiKeys: { adzuna: boolean; jooble: boolean; jsearch: boolean };
}

const dotClass = (s: SourceHealth) =>
  !s.ok ? 'bg-red-500' : s.count > 0 ? 'bg-green-500' : 'bg-yellow-500';

export default function SourceHealthPanel() {
  const { showError } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<HealthResponse | null>(null);

  async function probe() {
    try {
      setLoading(true);
      const res = await apiFetch('/api/jobs/sources/health');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao testar as fontes');
      setData(json as HealthResponse);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Falha ao testar as fontes');
    } finally {
      setLoading(false);
    }
  }

  function openPanel() {
    setOpen(true);
    if (!data && !loading) void probe();
  }

  const ok = data?.sources.filter((s) => s.ok && s.count > 0).length ?? 0;
  const empty = data?.sources.filter((s) => s.ok && s.count === 0).length ?? 0;
  const failed = data?.sources.filter((s) => !s.ok).length ?? 0;

  return (
    <>
      <button
        onClick={openPanel}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h4l3 8 4-16 3 8h4" />
        </svg>
        Saúde das fontes
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Saúde das fontes de vagas</h3>
                {data && (
                  <p className="text-sm text-zinc-500">
                    <span className="text-green-600 dark:text-green-400">{ok} ok</span> ·{' '}
                    <span className="text-yellow-600 dark:text-yellow-400">{empty} sem resultados</span> ·{' '}
                    <span className="text-red-600 dark:text-red-400">{failed} com erro</span>
                    {' · '}query &quot;{data.query.keyword}&quot;
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={probe}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-700 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 disabled:opacity-50"
                >
                  {loading ? 'Testando…' : 'Testar de novo'}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto">
              {/* API key status */}
              {data && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {(['adzuna', 'jooble', 'jsearch'] as const).map((k) => (
                    <span
                      key={k}
                      className={`text-xs px-2 py-1 rounded-full ${
                        data.apiKeys[k]
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500'
                      }`}
                    >
                      {k} {data.apiKeys[k] ? '· key ✓' : '· sem key'}
                    </span>
                  ))}
                </div>
              )}

              {loading && !data && (
                <p className="text-sm text-zinc-500 text-center py-8">Testando todas as fontes…</p>
              )}

              {data && (
                <ul className="space-y-1">
                  {data.sources.map((s) => (
                    <li
                      key={s.source}
                      className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                    >
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass(s)}`} />
                      <span className="font-medium text-sm text-zinc-800 dark:text-zinc-200 flex-1 truncate">
                        {s.source}
                      </span>
                      {s.ok ? (
                        <span className="text-xs text-zinc-500">{s.count} vaga(s)</span>
                      ) : (
                        <span className="text-xs text-red-500 truncate max-w-[45%]" title={s.error}>
                          {s.error}
                        </span>
                      )}
                      <span className="text-xs text-zinc-400 w-14 text-right">{s.latencyMs}ms</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-700">
              <p className="text-xs text-zinc-500">
                🟢 retornou vagas · 🟡 ok mas 0 resultados (query/região ou key faltando) · 🔴 erro
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
