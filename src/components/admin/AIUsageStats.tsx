'use client';

import { useState, useEffect } from 'react';

interface UsageStats {
  total: {
    cost: number;
    tokens: number;
    requests: number;
  };
  daily: Array<{
    date: string;
    cost: number;
    tokens: number;
    requests: number;
  }>;
  byFeature: Array<{
    feature: string;
    cost: number;
    tokens: number;
    requests: number;
  }>;
  recentLogs: Array<{
    id: string;
    feature: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
    latencyMs: number;
    success: boolean;
    error: string | null;
    createdAt: string;
  }>;
}

interface QuotaStatus {
  withinLimits: boolean;
  dailyUsed: number;
  monthlyUsed: number;
  dailyLimit: number;
  monthlyLimit: number;
  dailyPercent: number;
  monthlyPercent: number;
  alertThreshold: number;
  shouldAlert: boolean;
}

interface APIResponse {
  stats: UsageStats;
  quota: QuotaStatus;
  today: { cost: number; tokens: number; requests: number };
  month: { cost: number; tokens: number; requests: number };
}

const FEATURE_LABELS: Record<string, string> = {
  'job-extraction': 'Job Extraction',
  'project-summary': 'Project Summary',
  'bio-generation': 'Bio Generation',
  'readme-analysis': 'README Analysis',
  'skills-suggestion': 'Skills Suggestion',
  'resume-analysis': 'Resume Analysis',
  'alert-suggestions': 'Alert Suggestions',
  'wakatime-ranking': 'WakaTime Ranking',
};

const FEATURE_COLORS: Record<string, string> = {
  'job-extraction': 'bg-blue-500',
  'project-summary': 'bg-green-500',
  'bio-generation': 'bg-purple-500',
  'readme-analysis': 'bg-orange-500',
  'skills-suggestion': 'bg-pink-500',
  'resume-analysis': 'bg-red-500',
  'alert-suggestions': 'bg-amber-500',
  'wakatime-ranking': 'bg-indigo-500',
};

export default function AIUsageStats() {
  const [data, setData] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [editingQuota, setEditingQuota] = useState(false);
  const [quotaForm, setQuotaForm] = useState({
    dailyLimit: 5,
    monthlyLimit: 50,
    alertAt: 80,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [days]);

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/ai-usage?days=${days}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const json = await res.json();
      setData(json);

      // Initialize quota form with current values
      if (json.quota) {
        setQuotaForm({
          dailyLimit: json.quota.dailyLimit,
          monthlyLimit: json.quota.monthlyLimit,
          alertAt: json.quota.alertThreshold,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function saveQuota() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai-usage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyLimit: quotaForm.dailyLimit,
          monthlyLimit: quotaForm.monthlyLimit,
          alertAt: quotaForm.alertAt / 100,
        }),
      });

      if (!res.ok) throw new Error('Failed to save');

      setEditingQuota(false);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
          ))}
        </div>
        <div className="h-64 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-300">{error}</p>
        <button
          onClick={fetchData}
          className="mt-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { stats, quota, today, month } = data;

  // Calculate max cost for feature bar chart
  const maxFeatureCost = Math.max(...stats.byFeature.map((f) => f.cost), 0.001);

  return (
    <div className="space-y-6">
      {/* Alert banner */}
      {quota.shouldAlert && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-amber-700 dark:text-amber-300 text-sm">
            Approaching quota limit! Daily: {quota.dailyPercent.toFixed(1)}%, Monthly: {quota.monthlyPercent.toFixed(1)}%
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Today</p>
          <p className="text-2xl font-bold text-green-500">${today.cost.toFixed(4)}</p>
          <p className="text-xs text-zinc-400">{today.requests} requests</p>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">This Month</p>
          <p className="text-2xl font-bold text-blue-500">${month.cost.toFixed(4)}</p>
          <p className="text-xs text-zinc-400">{month.requests} requests</p>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Daily Limit</p>
          <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-300">
            ${quota.dailyUsed.toFixed(4)}
            <span className="text-sm font-normal text-zinc-400">/${quota.dailyLimit}</span>
          </p>
          <div className="mt-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${quota.dailyPercent > 80 ? 'bg-red-500' : quota.dailyPercent > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(quota.dailyPercent, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Monthly Limit</p>
          <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-300">
            ${quota.monthlyUsed.toFixed(4)}
            <span className="text-sm font-normal text-zinc-400">/${quota.monthlyLimit}</span>
          </p>
          <div className="mt-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${quota.monthlyPercent > 80 ? 'bg-red-500' : quota.monthlyPercent > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(quota.monthlyPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Usage by Feature (Last {days} days)
        </h3>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      {/* Feature breakdown */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
        {stats.byFeature.length === 0 ? (
          <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">No usage data yet</p>
        ) : (
          <div className="space-y-3">
            {stats.byFeature
              .sort((a, b) => b.cost - a.cost)
              .map((feature) => {
                const percent = (feature.cost / maxFeatureCost) * 100;
                const color = FEATURE_COLORS[feature.feature] || 'bg-zinc-500';

                return (
                  <div key={feature.feature}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {FEATURE_LABELS[feature.feature] || feature.feature}
                      </span>
                      <span className="text-zinc-500 dark:text-zinc-400">
                        ${feature.cost.toFixed(4)} ({feature.requests} requests)
                      </span>
                    </div>
                    <div className="h-3 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color} transition-all duration-300`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Quota Settings */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Quota Settings</h3>
          {!editingQuota && (
            <button
              onClick={() => setEditingQuota(true)}
              className="text-sm text-blue-500 hover:text-blue-600"
            >
              Edit
            </button>
          )}
        </div>

        {editingQuota ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">Daily Limit ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={quotaForm.dailyLimit}
                  onChange={(e) => setQuotaForm({ ...quotaForm, dailyLimit: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">Monthly Limit ($)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={quotaForm.monthlyLimit}
                  onChange={(e) => setQuotaForm({ ...quotaForm, monthlyLimit: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">Alert at (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={quotaForm.alertAt}
                  onChange={(e) => setQuotaForm({ ...quotaForm, alertAt: parseFloat(e.target.value) || 80 })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveQuota}
                disabled={saving}
                className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setEditingQuota(false)}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Daily Limit:</span>
              <span className="ml-2 text-zinc-900 dark:text-zinc-100">${quota.dailyLimit}</span>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Monthly Limit:</span>
              <span className="ml-2 text-zinc-900 dark:text-zinc-100">${quota.monthlyLimit}</span>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Alert at:</span>
              <span className="ml-2 text-zinc-900 dark:text-zinc-100">{quota.alertThreshold}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Recent Logs */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Recent Requests</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 text-left text-zinc-500 dark:text-zinc-400 font-medium">Time</th>
                <th className="px-4 py-2 text-left text-zinc-500 dark:text-zinc-400 font-medium">Feature</th>
                <th className="px-4 py-2 text-right text-zinc-500 dark:text-zinc-400 font-medium">Tokens</th>
                <th className="px-4 py-2 text-right text-zinc-500 dark:text-zinc-400 font-medium">Cost</th>
                <th className="px-4 py-2 text-right text-zinc-500 dark:text-zinc-400 font-medium">Latency</th>
                <th className="px-4 py-2 text-center text-zinc-500 dark:text-zinc-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
              {stats.recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No requests yet
                  </td>
                </tr>
              ) : (
                stats.recentLogs.slice(0, 20).map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100">
                      {FEATURE_LABELS[log.feature] || log.feature}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">
                      {log.totalTokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-900 dark:text-zinc-100 font-mono">
                      ${log.cost.toFixed(5)}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">
                      {(log.latencyMs / 1000).toFixed(2)}s
                    </td>
                    <td className="px-4 py-2 text-center">
                      {log.success ? (
                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full" title="Success" />
                      ) : (
                        <span className="inline-block w-2 h-2 bg-red-500 rounded-full" title={log.error || 'Failed'} />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
