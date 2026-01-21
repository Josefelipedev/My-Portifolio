'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface SystemLog {
  id: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  source: string;
  message: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

interface LogStats {
  byLevel: {
    error: number;
    warn: number;
    info: number;
    debug: number;
  };
  errorsBySource: Record<string, number>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const LEVEL_COLORS = {
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  warn: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  debug: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const LEVEL_ICONS = {
  error: '❌',
  warn: '⚠️',
  info: 'ℹ️',
  debug: '🔍',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [levelFilter, setLevelFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Expanded log details
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteOption, setDeleteOption] = useState<'all' | 'errors' | 'old'>('old');
  const [deleting, setDeleting] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '50');
      if (levelFilter !== 'all') params.set('level', levelFilter);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetch(`/api/admin/logs?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data = await response.json();
      setLogs(data.logs);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, levelFilter, sourceFilter, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleDelete = async () => {
    setDeleting(true);

    try {
      const params = new URLSearchParams();

      if (deleteOption === 'old') {
        // Delete logs older than 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        params.set('olderThan', sevenDaysAgo.toISOString());
      } else if (deleteOption === 'errors') {
        params.set('level', 'error');
      }
      // 'all' - no params = delete all

      const response = await fetch(`/api/admin/logs?${params}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete logs');
      }

      const data = await response.json();
      alert(`${data.deleted} logs deleted`);

      setShowDeleteModal(false);
      fetchLogs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const sources = [
    'all',
    'geekhunter',
    'vagascombr',
    'python-scraper',
    'remoteok',
    'remotive',
    'arbeitnow',
    'adzuna',
    'jooble',
    'jsearch',
    'netempregos',
    'linkedin',
    'ai-extraction',
    'api',
    'auth',
    'cron',
    'system',
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href="/admin"
            className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block"
          >
            ← Back to Admin
          </Link>
          <h1 className="text-3xl font-bold">System Logs</h1>
          <p className="text-gray-400 mt-1">
            Monitor application logs and errors
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2"
          >
            🗑️ Clear Logs
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="text-red-400 text-sm font-medium">Errors (24h)</div>
            <div className="text-2xl font-bold text-red-300">
              {stats.byLevel.error}
            </div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="text-yellow-400 text-sm font-medium">
              Warnings (24h)
            </div>
            <div className="text-2xl font-bold text-yellow-300">
              {stats.byLevel.warn}
            </div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="text-blue-400 text-sm font-medium">Info (24h)</div>
            <div className="text-2xl font-bold text-blue-300">
              {stats.byLevel.info}
            </div>
          </div>
          <div className="bg-gray-500/10 border border-gray-500/30 rounded-lg p-4">
            <div className="text-gray-400 text-sm font-medium">Total Logs</div>
            <div className="text-2xl font-bold text-gray-300">
              {pagination?.total || 0}
            </div>
          </div>
        </div>
      )}

      {/* Errors by Source */}
      {stats && Object.keys(stats.errorsBySource).length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">
            Errors by Source (24h)
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.errorsBySource).map(([source, count]) => (
              <button
                key={source}
                onClick={() => {
                  setSourceFilter(source);
                  setLevelFilter('error');
                }}
                className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-sm text-red-300 hover:bg-red-500/30 transition-colors"
              >
                {source}: {count}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Level Filter */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Level</label>
            <select
              value={levelFilter}
              onChange={(e) => {
                setLevelFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
            >
              <option value="all">All Levels</option>
              <option value="error">❌ Error</option>
              <option value="warn">⚠️ Warning</option>
              <option value="info">ℹ️ Info</option>
              <option value="debug">🔍 Debug</option>
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
            >
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s === 'all' ? 'All Sources' : s}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-400 mb-1">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search in messages..."
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500"
            />
          </div>
        </div>

        {/* Active Filters */}
        {(levelFilter !== 'all' || sourceFilter !== 'all' || searchQuery) && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-gray-400">Active filters:</span>
            {levelFilter !== 'all' && (
              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">
                Level: {levelFilter}
              </span>
            )}
            {sourceFilter !== 'all' && (
              <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded">
                Source: {sourceFilter}
              </span>
            )}
            {searchQuery && (
              <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded">
                Search: {searchQuery}
              </span>
            )}
            <button
              onClick={() => {
                setLevelFilter('all');
                setSourceFilter('all');
                setSearchQuery('');
                setPage(1);
              }}
              className="text-xs text-gray-400 hover:text-white"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading logs...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Logs Table */}
      {!loading && !error && (
        <>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800">
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">
                      Time
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">
                      Level
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">
                      Source
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">
                      Message
                    </th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-gray-400">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center py-12 text-gray-500"
                      >
                        No logs found
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <>
                        <tr
                          key={log.id}
                          className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                            {formatDate(log.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${LEVEL_COLORS[log.level]}`}
                            >
                              {LEVEL_ICONS[log.level]} {log.level}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-300 bg-gray-700 px-2 py-1 rounded">
                              {log.source}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300 max-w-md truncate">
                            {log.message}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {log.details && (
                              <button
                                onClick={() =>
                                  setExpandedLog(
                                    expandedLog === log.id ? null : log.id
                                  )
                                }
                                className="text-blue-400 hover:text-blue-300 text-sm"
                              >
                                {expandedLog === log.id ? '▼ Hide' : '▶ Show'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {expandedLog === log.id && log.details && (
                          <tr className="bg-gray-800/80">
                            <td colSpan={5} className="px-4 py-3">
                              <pre className="text-xs text-gray-300 bg-gray-900 p-3 rounded overflow-x-auto max-h-64 overflow-y-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-400">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)}{' '}
                of {pagination.total} logs
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-400">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Clear Logs</h2>
            <p className="text-gray-400 mb-4">
              Select which logs you want to delete:
            </p>

            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="deleteOption"
                  value="old"
                  checked={deleteOption === 'old'}
                  onChange={() => setDeleteOption('old')}
                  className="text-blue-500"
                />
                <span>Logs older than 7 days</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="deleteOption"
                  value="errors"
                  checked={deleteOption === 'errors'}
                  onChange={() => setDeleteOption('errors')}
                  className="text-blue-500"
                />
                <span>All error logs</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer text-red-400">
                <input
                  type="radio"
                  name="deleteOption"
                  value="all"
                  checked={deleteOption === 'all'}
                  onChange={() => setDeleteOption('all')}
                  className="text-red-500"
                />
                <span>⚠️ Delete ALL logs</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
