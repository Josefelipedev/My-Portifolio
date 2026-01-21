'use client';

import { useState, useEffect, useCallback } from 'react';

interface AgentExecution {
  id: string;
  agentName: string;
  status: string;
  durationMs: number;
  message: string | null;
  error: string | null;
}

interface PipelineExecution {
  id: string;
  source: string;
  keyword: string;
  totalDurationMs: number;
  jobsFound: number;
  status: string;
  trigger: string;
  createdAt: string;
  agents: AgentExecution[];
}

interface AgentStats {
  avgDurationMs: number;
  successRate: number;
  count: number;
}

interface Stats {
  period: string;
  totalExecutions: number;
  avgDurationMs: number;
  successRate: number;
  totalJobsFound: number;
  byAgent: Record<string, AgentStats>;
}

interface TrackingData {
  pipelines: PipelineExecution[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  stats: Stats;
}

const AGENT_ORDER = ['search', 'page', 'analyzer', 'extractor'];
const AGENT_COLORS: Record<string, string> = {
  search: 'bg-blue-500',
  page: 'bg-purple-500',
  analyzer: 'bg-green-500',
  extractor: 'bg-orange-500',
};

export default function AgentCostTracker() {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<PipelineExecution | null>(null);
  const [filter, setFilter] = useState({
    source: '',
    status: '',
    hours: '24',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filter.source) params.set('source', filter.source);
      if (filter.status) params.set('status', filter.status);
      params.set('hours', filter.hours);
      params.set('limit', '20');

      const response = await fetch(`/api/admin/agent-tracking?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch data');

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 dark:text-green-400';
      case 'partial':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'failed':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-zinc-600 dark:text-zinc-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'partial':
        return (
          <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Calculate max duration for timeline scaling
  const getMaxDuration = () => {
    if (!data?.stats.byAgent) return 5000;
    const maxAvg = Math.max(...Object.values(data.stats.byAgent).map((a) => a.avgDurationMs));
    return Math.max(maxAvg * 1.2, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header with refresh controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Agent Execution Costs</h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-red-500 focus:ring-red-500"
            />
            <span className="text-xs text-zinc-500">Auto (10s)</span>
            {autoRefresh && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
          </label>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filter.source}
          onChange={(e) => setFilter({ ...filter, source: e.target.value })}
          className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
        >
          <option value="">All Sources</option>
          <option value="geekhunter">GeekHunter</option>
          <option value="vagascombr">Vagas.com.br</option>
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
        >
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="partial">Partial</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={filter.hours}
          onChange={(e) => setFilter({ ...filter, hours: e.target.value })}
          className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
        >
          <option value="1">Last 1 hour</option>
          <option value="6">Last 6 hours</option>
          <option value="24">Last 24 hours</option>
          <option value="168">Last 7 days</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {data && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                {data.stats.totalExecutions}
              </div>
              <div className="text-xs text-zinc-500 mt-1">Executions ({data.stats.period})</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {formatDuration(data.stats.avgDurationMs)}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">Avg Time</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {data.stats.successRate}%
              </div>
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">Success Rate</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {data.stats.totalJobsFound}
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">Jobs Found</div>
            </div>
          </div>

          {/* Pipeline Timeline */}
          {Object.keys(data.stats.byAgent).length > 0 && (
            <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">
                Average Pipeline Duration
              </h4>
              <div className="space-y-3">
                {AGENT_ORDER.map((agentName) => {
                  const agent = data.stats.byAgent[agentName];
                  if (!agent) return null;

                  const maxDuration = getMaxDuration();
                  const widthPercent = Math.min((agent.avgDurationMs / maxDuration) * 100, 100);

                  return (
                    <div key={agentName} className="flex items-center gap-3">
                      <div className="w-20 text-xs font-medium text-zinc-600 dark:text-zinc-400 capitalize">
                        {agentName}
                      </div>
                      <div className="flex-1 bg-zinc-200 dark:bg-zinc-600 rounded-full h-5 relative overflow-hidden">
                        <div
                          className={`${AGENT_COLORS[agentName]} h-full rounded-full transition-all duration-500`}
                          style={{ width: `${widthPercent}%` }}
                        />
                        <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-white mix-blend-difference">
                          {formatDuration(agent.avgDurationMs)} ({agent.successRate}%)
                        </span>
                      </div>
                      <div className="w-12 text-xs text-zinc-500 text-right">{agent.count}x</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Executions Table */}
          <div>
            <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
              Recent Executions
            </h4>
            {data.pipelines.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                No executions found for the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                      <th className="text-left py-2 px-3 text-zinc-500 font-medium">Time</th>
                      <th className="text-left py-2 px-3 text-zinc-500 font-medium">Source</th>
                      <th className="text-left py-2 px-3 text-zinc-500 font-medium">Keyword</th>
                      <th className="text-center py-2 px-3 text-zinc-500 font-medium">Status</th>
                      <th className="text-center py-2 px-3 text-zinc-500 font-medium">Jobs</th>
                      <th className="text-right py-2 px-3 text-zinc-500 font-medium">Duration</th>
                      <th className="text-center py-2 px-3 text-zinc-500 font-medium">Trigger</th>
                      <th className="text-center py-2 px-3 text-zinc-500 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pipelines.map((pipeline) => (
                      <tr
                        key={pipeline.id}
                        className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/30"
                      >
                        <td className="py-2 px-3 text-zinc-600 dark:text-zinc-400">
                          <div>{formatTime(pipeline.createdAt)}</div>
                          <div className="text-xs text-zinc-400">{formatDate(pipeline.createdAt)}</div>
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs rounded">
                            {pipeline.source}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300 max-w-32 truncate">
                          {pipeline.keyword}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {getStatusIcon(pipeline.status)}
                            <span className={`text-xs font-medium ${getStatusColor(pipeline.status)}`}>
                              {pipeline.status}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center font-medium text-zinc-700 dark:text-zinc-300">
                          {pipeline.jobsFound}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-zinc-600 dark:text-zinc-400">
                          {formatDuration(pipeline.totalDurationMs)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 text-xs rounded ${
                              pipeline.trigger === 'scheduled'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                : pipeline.trigger === 'alert'
                                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                                : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            {pipeline.trigger}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => setSelectedPipeline(pipeline)}
                            className="text-red-500 hover:text-red-600 text-xs"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Pipeline Detail Modal */}
      {selectedPipeline && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Pipeline Details</h3>
                <p className="text-sm text-zinc-500">
                  {selectedPipeline.source} - {selectedPipeline.keyword}
                </p>
              </div>
              <button
                onClick={() => setSelectedPipeline(null)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {/* Pipeline Summary */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    {formatDuration(selectedPipeline.totalDurationMs)}
                  </div>
                  <div className="text-xs text-zinc-500">Total Duration</div>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    {selectedPipeline.jobsFound}
                  </div>
                  <div className="text-xs text-zinc-500">Jobs Found</div>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-3 text-center">
                  <div className={`text-xl font-bold ${getStatusColor(selectedPipeline.status)}`}>
                    {selectedPipeline.status}
                  </div>
                  <div className="text-xs text-zinc-500">Status</div>
                </div>
              </div>

              {/* Agent Timeline */}
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Agent Execution</h4>
              <div className="space-y-2">
                {selectedPipeline.agents
                  .sort((a, b) => AGENT_ORDER.indexOf(a.agentName) - AGENT_ORDER.indexOf(b.agentName))
                  .map((agent) => {
                    const maxDuration = Math.max(
                      ...selectedPipeline.agents.map((a) => a.durationMs),
                      1000
                    );
                    const widthPercent = Math.min((agent.durationMs / maxDuration) * 100, 100);

                    return (
                      <div
                        key={agent.id}
                        className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-700 dark:text-zinc-300 capitalize">
                              {agent.agentName}
                            </span>
                            {getStatusIcon(agent.status)}
                          </div>
                          <span className="font-mono text-sm text-zinc-600 dark:text-zinc-400">
                            {formatDuration(agent.durationMs)}
                          </span>
                        </div>
                        <div className="bg-zinc-200 dark:bg-zinc-600 rounded-full h-2 mb-2">
                          <div
                            className={`${AGENT_COLORS[agent.agentName] || 'bg-zinc-500'} h-full rounded-full`}
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                        {agent.message && (
                          <p className="text-xs text-zinc-500">{agent.message}</p>
                        )}
                        {agent.error && (
                          <p className="text-xs text-red-500 mt-1">{agent.error}</p>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
