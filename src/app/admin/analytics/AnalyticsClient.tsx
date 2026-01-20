'use client';

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
  const maxVisits = Math.max(...data.visitsByDay.map((d) => d.count), 1);

  return (
    <>
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
