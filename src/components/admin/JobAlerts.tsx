'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

interface JobAlertMatch {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  matchedAt: string;
  notified: boolean;
}

interface JobAlert {
  id: string;
  name: string;
  keyword: string;
  countries: string;
  sources: string;
  filters?: string;
  isActive: boolean;
  lastRun?: string;
  createdAt: string;
  matches: JobAlertMatch[];
  _count: {
    matches: number;
  };
}

interface AlertSuggestion {
  name: string;
  keyword: string;
  countries: string;
  sources: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

const SOURCES = [
  { value: 'all', label: 'All Sources' },
  { value: 'remoteok', label: 'RemoteOK' },
  { value: 'remotive', label: 'Remotive' },
  { value: 'arbeitnow', label: 'ArbeitNow' },
  { value: 'adzuna', label: 'Adzuna' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'jooble', label: 'Jooble' },
  { value: 'geekhunter', label: 'GeekHunter' },
  { value: 'vagascombr', label: 'Vagas.com.br' },
  { value: 'netempregos', label: 'Net-Empregos' },
];

const COUNTRIES = [
  { value: 'all', label: 'All Countries' },
  { value: 'br', label: 'Brazil' },
  { value: 'pt', label: 'Portugal' },
  { value: 'us', label: 'USA' },
  { value: 'gb', label: 'UK' },
  { value: 'de', label: 'Germany' },
];

export default function JobAlerts() {
  const { showError, showSuccess, showInfo } = useToast();
  const { confirm } = useConfirm();
  const [alerts, setAlerts] = useState<JobAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [runningAlert, setRunningAlert] = useState<string | null>(null);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AlertSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    keyword: '',
    countries: 'all',
    sources: 'all',
  });

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/jobs/alerts');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch alerts');
      }

      setAlerts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.keyword.trim()) return;

    try {
      setCreating(true);
      const response = await fetch('/api/jobs/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create alert');
      }

      await fetchAlerts();
      setShowCreateForm(false);
      setFormData({ name: '', keyword: '', countries: 'all', sources: 'all' });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create alert');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Alert',
      message: 'Are you sure you want to delete this alert?',
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/jobs/alerts?id=${id}`, { method: 'DELETE' });

      if (!response.ok) {
        throw new Error('Failed to delete alert');
      }

      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete alert');
    }
  };

  const handleToggleActive = async (jobAlert: JobAlert) => {
    try {
      const response = await fetch('/api/jobs/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: jobAlert.id, isActive: !jobAlert.isActive }),
      });

      if (!response.ok) {
        throw new Error('Failed to update alert');
      }

      setAlerts((prev) =>
        prev.map((a) => (a.id === jobAlert.id ? { ...a, isActive: !a.isActive } : a))
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update alert');
    }
  };

  const handleRunAlert = async (alertId: string) => {
    try {
      setRunningAlert(alertId);
      const response = await fetch('/api/jobs/alerts/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to run alert');
      }

      showInfo(data.message);
      await fetchAlerts();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to run alert');
    } finally {
      setRunningAlert(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const response = await fetch('/api/jobs/alerts/suggestions');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch suggestions');
      }

      setSuggestions(data.suggestions || []);
      setShowSuggestions(true);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to fetch suggestions');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const createFromSuggestion = (suggestion: AlertSuggestion) => {
    setFormData({
      name: suggestion.name,
      keyword: suggestion.keyword,
      countries: suggestion.countries.split(',')[0] || 'all',
      sources: suggestion.sources.split(',')[0] || 'all',
    });
    setShowCreateForm(true);
    setShowSuggestions(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-zinc-500">
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Loading alerts...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Job Alerts</h2>
          <p className="text-sm text-zinc-500">Get notified when new jobs match your criteria</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSuggestions}
            disabled={loadingSuggestions}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors"
          >
            {loadingSuggestions ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Suggestions
              </>
            )}
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Alert
          </button>
        </div>
      </div>

      {/* Create Alert Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Create New Alert
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Alert Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Senior React Jobs"
                  required
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Keyword *
                </label>
                <input
                  type="text"
                  value={formData.keyword}
                  onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                  placeholder="e.g., react developer"
                  required
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Countries
                  </label>
                  <select
                    value={formData.countries}
                    onChange={(e) => setFormData({ ...formData, countries: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Sources
                  </label>
                  <select
                    value={formData.sources}
                    onChange={(e) => setFormData({ ...formData, sources: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  >
                    {SOURCES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {creating ? 'Creating...' : 'Create Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Suggestions Panel */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                AI Suggestions based on your resume
              </h3>
            </div>
            <button
              onClick={() => setShowSuggestions(false)}
              className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="bg-white dark:bg-zinc-800 rounded-lg p-4 border border-purple-100 dark:border-purple-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {suggestion.name}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          suggestion.confidence === 'high'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : suggestion.confidence === 'medium'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                            : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {suggestion.confidence}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500 mt-1">{suggestion.reason}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded">
                        {suggestion.keyword}
                      </span>
                      <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs rounded">
                        {suggestion.countries}
                      </span>
                      <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs rounded">
                        {suggestion.sources}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => createFromSuggestion(suggestion)}
                    className="px-4 py-2 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-600 transition-colors whitespace-nowrap"
                  >
                    Create Alert
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 mb-2">No alerts yet.</p>
          <p className="text-sm text-zinc-500">Create an alert to get notified about new jobs.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white dark:bg-zinc-800 rounded-xl border overflow-hidden transition-colors ${
                alert.isActive
                  ? 'border-zinc-200 dark:border-zinc-700'
                  : 'border-zinc-100 dark:border-zinc-800 opacity-60'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {alert.name}
                      </h3>
                      {!alert.isActive && (
                        <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-500 text-xs rounded">
                          Paused
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs rounded">
                        {alert.keyword}
                      </span>
                      <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs rounded">
                        {COUNTRIES.find((c) => c.value === alert.countries)?.label || alert.countries}
                      </span>
                      <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs rounded">
                        {SOURCES.find((s) => s.value === alert.sources)?.label || alert.sources}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                      <span>{alert._count.matches} matches total</span>
                      {alert.lastRun && (
                        <span>Last run: {formatDate(alert.lastRun)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRunAlert(alert.id)}
                      disabled={runningAlert === alert.id || !alert.isActive}
                      className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                    >
                      {runningAlert === alert.id ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Running...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          </svg>
                          Run Now
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleToggleActive(alert)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        alert.isActive
                          ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {alert.isActive ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => handleDelete(alert.id)}
                      className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Recent Matches */}
                {alert.matches.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                    <button
                      onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                      className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${expandedAlert === alert.id ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Recent Matches ({alert.matches.length} of {alert._count.matches})
                    </button>

                    {expandedAlert === alert.id && (
                      <div className="mt-3 space-y-2">
                        {alert.matches.map((match) => (
                          <div
                            key={match.id}
                            className="p-3 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg"
                          >
                            <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                              {match.jobTitle}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                              <span>{match.company}</span>
                              <span>-</span>
                              <span>{formatDate(match.matchedAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
