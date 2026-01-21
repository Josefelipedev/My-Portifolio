'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface FunnelData {
  saved: number;
  applied: number;
  interview: number;
  offer: number;
  rejected: number;
}

interface WeeklyData {
  week: string;
  saved: number;
  applied: number;
}

interface SourceData {
  source: string;
  total: number;
  applied: number;
  interview: number;
  offer: number;
}

interface TopCompany {
  company: string;
  count: number;
  [key: string]: string | number;
}

interface AnalyticsData {
  funnel: FunnelData;
  weeklyActivity: WeeklyData[];
  sourceEffectiveness: SourceData[];
  avgTimeToInterview: number | null;
  topCompanies: TopCompany[];
  totalSavedJobs: number;
  totalApplications: number;
  recentSearches: number;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899'];

export default function JobAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/jobs/analytics');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch analytics');
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-zinc-500">
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Loading analytics...</span>
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

  if (!data) {
    return (
      <div className="text-center py-12 text-zinc-500">
        No analytics data available.
      </div>
    );
  }

  // Prepare funnel data for chart
  const funnelChartData = [
    { name: 'Saved', value: data.funnel.saved, fill: '#3b82f6' },
    { name: 'Applied', value: data.funnel.applied, fill: '#22c55e' },
    { name: 'Interview', value: data.funnel.interview, fill: '#eab308' },
    { name: 'Offer', value: data.funnel.offer, fill: '#06b6d4' },
    { name: 'Rejected', value: data.funnel.rejected, fill: '#ef4444' },
  ];

  // Calculate conversion rates
  const conversionRates = {
    savedToApplied: data.funnel.saved > 0 ? ((data.funnel.applied / data.funnel.saved) * 100).toFixed(1) : '0',
    appliedToInterview: data.funnel.applied > 0 ? ((data.funnel.interview / data.funnel.applied) * 100).toFixed(1) : '0',
    interviewToOffer: data.funnel.interview > 0 ? ((data.funnel.offer / data.funnel.interview) * 100).toFixed(1) : '0',
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Saved Jobs</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{data.totalSavedJobs}</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Applications</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{data.totalApplications}</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Avg. Days to Interview</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {data.avgTimeToInterview !== null ? data.avgTimeToInterview : '--'}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Searches (30d)</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{data.recentSearches}</p>
        </div>
      </div>

      {/* Conversion Rates */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Conversion Funnel</h3>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{conversionRates.savedToApplied}%</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Saved to Applied</p>
          </div>
          <div className="text-center p-4 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">{conversionRates.appliedToInterview}%</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Applied to Interview</p>
          </div>
          <div className="text-center p-4 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{conversionRates.interviewToOffer}%</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Interview to Offer</p>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
              <XAxis type="number" className="text-xs" />
              <YAxis dataKey="name" type="category" width={80} className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-zinc-800)',
                  border: '1px solid var(--color-zinc-700)',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {funnelChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly Activity */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Weekly Activity</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.weeklyActivity}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
              <XAxis dataKey="week" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-zinc-800)',
                  border: '1px solid var(--color-zinc-700)',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="saved" stroke="#3b82f6" strokeWidth={2} name="Saved" />
              <Line type="monotone" dataKey="applied" stroke="#22c55e" strokeWidth={2} name="Applied" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Source Effectiveness & Top Companies */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Source Effectiveness */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Source Effectiveness</h3>
          {data.sourceEffectiveness.length > 0 ? (
            <div className="space-y-3">
              {data.sourceEffectiveness.map((source, index) => (
                <div key={source.source} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{source.source}</span>
                      <span className="text-sm text-zinc-500">{source.total} apps</span>
                    </div>
                    <div className="flex gap-2 text-xs text-zinc-400 mt-1">
                      <span>{source.applied} applied</span>
                      <span>/</span>
                      <span>{source.interview} interview</span>
                      <span>/</span>
                      <span>{source.offer} offer</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">No source data yet.</p>
          )}
        </div>

        {/* Top Companies */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Top Applied Companies</h3>
          {data.topCompanies.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.topCompanies}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="company"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {data.topCompanies.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">No company data yet.</p>
          )}
        </div>
      </div>

      {/* Status Distribution */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Application Status Distribution</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-700 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-zinc-400" />
            <span className="text-sm text-zinc-600 dark:text-zinc-300">Saved: {data.funnel.saved}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm text-blue-700 dark:text-blue-300">Applied: {data.funnel.applied}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-sm text-yellow-700 dark:text-yellow-300">Interview: {data.funnel.interview}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm text-green-700 dark:text-green-300">Offer: {data.funnel.offer}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-sm text-red-700 dark:text-red-300">Rejected: {data.funnel.rejected}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
