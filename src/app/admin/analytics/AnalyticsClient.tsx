'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AnalyticsData {
  overview: {
    totalVisits: number;
    uniqueVisits: number;
    todayVisits: number;
    todayUnique: number;
  };
  visitsByDay: { date: string; count: number }[];
  devices: { name: string; count: number }[];
  browsers: { name: string; count: number }[];
  operatingSystems: { name: string; count: number }[];
  topReferrers: { url: string; count: number }[];
  topPages: { page: string; count: number }[];
  recentVisits: {
    id: string;
    visitorId: string;
    page: string;
    referrer: string | null;
    ipAddress: string | null;
    device: string | null;
    browser: string | null;
    os: string | null;
    createdAt: string;
  }[];
}

export default function AnalyticsClient({ data }: { data: AnalyticsData }) {
  const router = useRouter();
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const maxVisits = Math.max(...data.visitsByDay.map((d) => d.count), 1);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/analytics', { method: 'DELETE' });
      if (res.ok) {
        setShowResetModal(false);
        router.refresh();
      } else {
        alert('Failed to reset analytics');
      }
    } catch {
      alert('Error resetting analytics');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Reset Analytics</h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Are you sure you want to reset all analytics data? This action cannot be undone and will delete all visitor statistics.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isResetting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Resetting...
                  </>
                ) : (
                  'Reset All Data'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header with Reset Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowResetModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors border border-red-200 dark:border-red-800"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Reset Analytics
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Visits" value={data.overview.totalVisits} color="blue" />
        <StatCard title="Unique Visitors" value={data.overview.uniqueVisits} color="purple" />
        <StatCard title="Today's Visits" value={data.overview.todayVisits} color="green" />
        <StatCard title="Today's Unique" value={data.overview.todayUnique} color="amber" />
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Visits Chart */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Last 7 Days</h3>
          <div className="flex items-end gap-2 h-32">
            {data.visitsByDay.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-red-500 rounded-t transition-all"
                  style={{ height: `${(day.count / maxVisits) * 100}%`, minHeight: day.count > 0 ? '4px' : '0' }}
                />
                <span className="text-[10px] text-zinc-500">{new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}</span>
                <span className="text-[10px] text-zinc-400">{day.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Device Breakdown */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Devices (30 days)</h3>
          <div className="space-y-2">
            {data.devices.length === 0 ? (
              <p className="text-sm text-zinc-500">No data yet</p>
            ) : (
              data.devices.map((device) => {
                const total = data.devices.reduce((sum, d) => sum + d.count, 0);
                const percentage = total > 0 ? (device.count / total) * 100 : 0;
                return (
                  <div key={device.name} className="flex items-center gap-3">
                    <DeviceIcon device={device.name} />
                    <span className="text-sm text-zinc-600 dark:text-zinc-400 w-20">{device.name}</span>
                    <div className="flex-1 bg-zinc-100 dark:bg-zinc-700 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500 w-12 text-right">{percentage.toFixed(0)}%</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Browsers and OS */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Browsers */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Browsers (30 days)</h3>
          <div className="space-y-2">
            {data.browsers.length === 0 ? (
              <p className="text-sm text-zinc-500">No data yet</p>
            ) : (
              data.browsers.slice(0, 5).map((browser) => {
                const total = data.browsers.reduce((sum, b) => sum + b.count, 0);
                const percentage = total > 0 ? (browser.count / total) * 100 : 0;
                return (
                  <div key={browser.name} className="flex items-center gap-3">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400 w-20">{browser.name}</span>
                    <div className="flex-1 bg-zinc-100 dark:bg-zinc-700 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500 w-16 text-right">{browser.count}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* OS */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Operating Systems (30 days)</h3>
          <div className="space-y-2">
            {data.operatingSystems.length === 0 ? (
              <p className="text-sm text-zinc-500">No data yet</p>
            ) : (
              data.operatingSystems.slice(0, 5).map((os) => {
                const total = data.operatingSystems.reduce((sum, o) => sum + o.count, 0);
                const percentage = total > 0 ? (os.count / total) * 100 : 0;
                return (
                  <div key={os.name} className="flex items-center gap-3">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400 w-20">{os.name}</span>
                    <div className="flex-1 bg-zinc-100 dark:bg-zinc-700 rounded-full h-2">
                      <div
                        className="bg-amber-500 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500 w-16 text-right">{os.count}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Top Referrers and Pages */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Referrers */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Top Referrers</h3>
          {data.topReferrers.length === 0 ? (
            <p className="text-sm text-zinc-500">No referrer data yet</p>
          ) : (
            <div className="space-y-2">
              {data.topReferrers.slice(0, 5).map((ref, i) => {
                let hostname = 'Direct';
                try {
                  if (ref.url && ref.url !== 'Direct') {
                    hostname = new URL(ref.url).hostname;
                  }
                } catch {
                  hostname = ref.url || 'Direct';
                }
                return (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate flex-1">
                      {hostname}
                    </span>
                    <span className="text-xs text-zinc-500 ml-2">{ref.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Pages */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Top Pages</h3>
          {data.topPages.length === 0 ? (
            <p className="text-sm text-zinc-500">No page data yet</p>
          ) : (
            <div className="space-y-2">
              {data.topPages.slice(0, 5).map((page, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">{page.page}</span>
                  <span className="text-xs text-zinc-500">{page.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Visits Table */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent Visits</h3>
        </div>
        {data.recentVisits.length === 0 ? (
          <p className="text-sm text-zinc-500 p-4">No visits recorded yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Time</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Visitor</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">IP</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Page</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Device</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Browser</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">OS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
                {data.recentVisits.map((visit) => (
                  <tr key={visit.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {new Date(visit.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-zinc-500 font-mono text-xs">{visit.visitorId}</td>
                    <td className="px-4 py-2 text-zinc-500 font-mono text-xs">{visit.ipAddress || '-'}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{visit.page}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        visit.device === 'mobile' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                        visit.device === 'tablet' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                        'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                      }`}>
                        {visit.device || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{visit.browser || '-'}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{visit.os || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  const colorClasses = {
    blue: 'text-red-500',
    purple: 'text-purple-500',
    green: 'text-green-500',
    amber: 'text-amber-500',
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
      <p className={`text-3xl font-bold ${colorClasses[color as keyof typeof colorClasses]}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{title}</p>
    </div>
  );
}

function DeviceIcon({ device }: { device: string }) {
  if (device === 'mobile') {
    return (
      <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  if (device === 'tablet') {
    return (
      <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
