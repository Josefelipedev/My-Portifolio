import prisma from '@/lib/prisma';
import EduPortugalPageWrapper from '@/components/admin/EduPortugalPageWrapper';

// Force dynamic to avoid build errors when tables don't exist yet
export const dynamic = 'force-dynamic';

// Helper to serialize sync log dates to strings
function serializeSyncLog(sync: {
  id: string;
  syncType: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  universitiesFound: number;
  universitiesCreated: number;
  universitiesUpdated: number;
  coursesFound: number;
  coursesCreated: number;
  coursesUpdated: number;
  currentPage: number;
  totalPages: number;
  currentLevel: string | null;
  errors: string | null;
} | null) {
  if (!sync) return null;
  return {
    ...sync,
    startedAt: sync.startedAt.toISOString(),
    completedAt: sync.completedAt?.toISOString() || null,
  };
}

async function getEduPortugalStats() {
  try {
    const [
      universitiesCount,
      coursesCount,
      coursesByLevel,
      universitiesByCity,
      universitiesByType,
      latestSync,
      runningSync,
      recentSyncs,
    ] = await Promise.all([
      prisma.university.count(),
      prisma.course.count(),
      prisma.course.groupBy({
        by: ['level'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.university.groupBy({
        by: ['city'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      prisma.university.groupBy({
        by: ['type'],
        _count: { id: true },
      }),
      prisma.eduPortugalSyncLog.findFirst({
        where: { status: 'completed' },
        orderBy: { completedAt: 'desc' },
      }),
      prisma.eduPortugalSyncLog.findFirst({
        where: { status: 'running' },
        orderBy: { startedAt: 'desc' },
      }),
      prisma.eduPortugalSyncLog.findMany({
        orderBy: { startedAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      universitiesCount,
      coursesCount,
      coursesByLevel: Object.fromEntries(
        coursesByLevel.map((item) => [item.level, item._count.id])
      ),
      universitiesByCity: Object.fromEntries(
        universitiesByCity
          .filter((item) => item.city)
          .map((item) => [item.city as string, item._count.id])
      ),
      universitiesByType: Object.fromEntries(
        universitiesByType
          .filter((item) => item.type)
          .map((item) => [item.type as string, item._count.id])
      ),
      latestSync: serializeSyncLog(latestSync),
      runningSync: serializeSyncLog(runningSync),
      recentSyncs: recentSyncs.map((s) => serializeSyncLog(s)!),
      error: null,
    };
  } catch (error) {
    console.error('Error fetching EduPortugal stats:', error);
    return {
      universitiesCount: 0,
      coursesCount: 0,
      coursesByLevel: {},
      universitiesByCity: {},
      universitiesByType: {},
      latestSync: null,
      runningSync: null,
      recentSyncs: [],
      error: 'Database tables not found. Please run: npx prisma db push',
    };
  }
}

export default async function EduPortugalAdminPage() {
  const stats = await getEduPortugalStats();

  return <EduPortugalPageWrapper {...stats} />;
}
