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
  searchedAt: string;
}

interface SearchHistoryProps {
  onSelectSearch: (keyword: string, countries: string, sources: string) => void;
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
      const response = await fetch('/api/jobs/history?limit=10');
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch search history:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    const confirmed = await confirm({
      title: 'Clear History',
      message: 'Limpar todo o historico de buscas?',
      type: 'danger',
      confirmText: 'Clear All',
    });
    if (!confirmed) return;

    try {
      await fetch('/api/jobs/history', { method: 'DELETE' });
      setHistory([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min atras`;
    if (diffHours < 24) return `${diffHours}h atras`;
    if (diffDays < 7) return `${diffDays}d atras`;
    return date.toLocaleDateString('pt-BR');
  };

  const formatCountries = (countries: string) => {
    if (countries === 'all') return '🌍';
    const flags: Record<string, string> = {
      remote: '🏠',
      pt: '🇵🇹',
      br: '🇧🇷',
    };
    return countries
      .split(',')
      .map((c) => flags[c.trim()] || c.trim().toUpperCase())
      .join(' ');
  };

  if (loading) {
    return null;
  }

  if (history.length === 0) {
    return null;
  }

  const displayedHistory = showAll ? history : history.slice(0, 5);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Buscas Recentes
        </h4>
        <button
          onClick={clearHistory}
          className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
        >
          Limpar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {displayedHistory.map((entry) => (
          <button
            key={entry.id}
            onClick={() => onSelectSearch(entry.keyword, entry.countries, entry.sources)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm transition-colors group"
          >
            <span>{formatCountries(entry.countries)}</span>
            <span className="font-medium">{entry.keyword}</span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              ({entry.resultCount})
            </span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
              {formatDate(entry.searchedAt)}
            </span>
          </button>
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

// Helper function to save search to history
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
      body: JSON.stringify({
        keyword,
        countries,
        sources,
        filters,
        resultCount,
      }),
    });
  } catch (err) {
    console.error('Failed to save search to history:', err);
  }
}
