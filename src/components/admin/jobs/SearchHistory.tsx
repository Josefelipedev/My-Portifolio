'use client';

import { useState, useEffect } from 'react';
import { useConfirm } from '@/components/ui/ConfirmDialog';

interface SearchHistoryEntry {
  id: string;
  keyword: string;
  countries: string;
  sources: string;
  filters?: string;
  resultCount: number;
  cachedUntil: string | null;
  isCached: boolean;
  searchedAt: string;
}

interface SearchHistoryProps {
  onSelectSearch: (keyword: string, countries: string, sources: string, forceRefresh?: boolean) => void;
}

export default function SearchHistory({ onSelectSearch }: SearchHistoryProps) {
  const { confirm } = useConfirm();
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/jobs/history?limit=20');
      if (response.ok) {
        setHistory(await response.json());
      }
    } catch (err) {
      console.error('Failed to fetch search history:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    const confirmed = await confirm({
      title: 'Limpar Histórico',
      message: 'Limpar todo o histórico de buscas e cache salvo?',
      type: 'danger',
      confirmText: 'Limpar tudo',
    });
    if (!confirmed) return;
    try {
      await fetch('/api/jobs/history', { method: 'DELETE' });
      setHistory([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const deleteEntry = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/jobs/history?id=${id}`, { method: 'DELETE' });
      setHistory((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  const formatCacheExpiry = (cachedUntil: string) => {
    const diffMs = new Date(cachedUntil).getTime() - Date.now();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return 'expirando';
    if (diffMins < 60) return `${diffMins}min`;
    return `${diffHours}h`;
  };

  const formatCountries = (countries: string) => {
    if (countries === 'all') return '🌍';
    const flags: Record<string, string> = { remote: '🏠', pt: '🇵🇹', br: '🇧🇷' };
    return countries.split(',').map((c) => flags[c.trim()] || c.trim().toUpperCase()).join(' ');
  };

  if (loading || history.length === 0) return null;

  const displayedHistory = showAll ? history : history.slice(0, 5);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Buscas Recentes
        </h4>
        <button onClick={clearHistory} className="text-xs text-zinc-400 hover:text-red-500 transition-colors">
          Limpar tudo
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {displayedHistory.map((entry) => (
          <div key={entry.id} className="relative group/chip">
            {/* Main chip — click to search */}
            <button
              onClick={() => onSelectSearch(entry.keyword, entry.countries, entry.sources)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 pr-8 rounded-lg text-sm transition-colors ${
                entry.isCached
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                  : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
              title={
                entry.isCached
                  ? `Cache — expira em ${formatCacheExpiry(entry.cachedUntil!)}`
                  : `Busca ao vivo • ${formatDate(entry.searchedAt)}`
              }
            >
              {entry.isCached ? (
                <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span className="text-xs">{formatCountries(entry.countries)}</span>
              <span className="font-medium">{entry.keyword}</span>
              <span className="text-xs opacity-50">({entry.resultCount})</span>
              {entry.isCached && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  ⚡{formatCacheExpiry(entry.cachedUntil!)}
                </span>
              )}
            </button>

            {/* Action buttons — shown on hover */}
            <div className="absolute top-0 right-0 h-full flex items-center pr-1 gap-0.5 opacity-0 group-hover/chip:opacity-100 transition-opacity">
              {/* Refresh (force live search) */}
              <button
                onClick={(e) => { e.stopPropagation(); onSelectSearch(entry.keyword, entry.countries, entry.sources, true); }}
                className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                title="Atualizar cache (busca ao vivo)"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              {/* Delete entry */}
              <button
                onClick={(e) => deleteEntry(e, entry.id)}
                className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                title="Remover do histórico"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {history.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          {showAll ? 'Mostrar menos' : `Ver todas (${history.length})`}
        </button>
      )}
    </div>
  );
}

export async function saveSearchToHistory(
  keyword: string,
  countries: string,
  sources: string,
  resultCount: number,
  filters?: object
) {
  try {
    await fetch('/api/jobs/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, countries, sources, filters, resultCount }),
    });
  } catch (err) {
    console.error('Failed to save search to history:', err);
  }
}
