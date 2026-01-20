import Link from 'next/link';
import prisma from '@/lib/prisma';
import JobsTabs from '@/components/admin/JobsTabs';

// Force dynamic to avoid build errors when tables don't exist yet
export const dynamic = 'force-dynamic';

export default async function JobsAdminPage() {
  const [savedJobsCount, applicationsStats] = await Promise.all([
    prisma.savedJob.count(),
    prisma.jobApplication.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
  ]);

  const statsMap = applicationsStats.reduce(
    (acc, item) => ({ ...acc, [item.status]: item._count.status }),
    {} as Record<string, number>
  );

  const totalApplications =
    (statsMap.saved || 0) +
    (statsMap.applied || 0) +
    (statsMap.interview || 0) +
    (statsMap.offer || 0) +
    (statsMap.rejected || 0);

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Job Search & Tracker</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Search remote jobs and track your applications
            </p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
          >
            Back to Admin
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
            <p className="text-2xl font-bold text-red-500">{savedJobsCount}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Saved Jobs</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
            <p className="text-2xl font-bold text-blue-500">{statsMap.applied || 0}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Applied</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
            <p className="text-2xl font-bold text-yellow-500">{statsMap.interview || 0}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Interview</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
            <p className="text-2xl font-bold text-green-500">{statsMap.offer || 0}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Offers</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
            <p className="text-2xl font-bold text-zinc-400">{statsMap.rejected || 0}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Rejected</p>
          </div>
        </div>

        {/* Tabs Component */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 md:p-6">
          <JobsTabs
            initialSavedCount={savedJobsCount}
            initialApplicationsCount={totalApplications}
          />
        </div>
      </div>
    </main>
  );
}
