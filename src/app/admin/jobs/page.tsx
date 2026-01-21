import prisma from '@/lib/prisma';
import JobsPageWrapper from '@/components/admin/JobsPageWrapper';

// Force dynamic to avoid build errors when tables don't exist yet
export const dynamic = 'force-dynamic';

async function getJobStats() {
  try {
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

    return { savedJobsCount, statsMap, totalApplications, error: null };
  } catch (error) {
    console.error('Error fetching job stats:', error);
    return {
      savedJobsCount: 0,
      statsMap: {} as Record<string, number>,
      totalApplications: 0,
      error: 'Database tables not found. Please run: npx prisma db push',
    };
  }
}

export default async function JobsAdminPage() {
  const { savedJobsCount, statsMap, totalApplications, error } = await getJobStats();

  return (
    <JobsPageWrapper
      savedJobsCount={savedJobsCount}
      totalApplications={totalApplications}
      statsMap={statsMap}
      error={error}
    />
  );
}
