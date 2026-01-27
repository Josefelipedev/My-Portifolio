import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';

/**
 * GET /api/admin/eduportugal/status
 *
 * Get current EduPortugal sync status and statistics.
 * Requires authentication.
 *
 * Query params:
 * - syncId: Get status of a specific sync (optional)
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const syncId = searchParams.get('syncId');

    // If specific sync requested
    if (syncId) {
      const sync = await prisma.eduPortugalSyncLog.findUnique({
        where: { id: syncId },
      });

      if (!sync) {
        return NextResponse.json({ error: 'Sync not found' }, { status: 404 });
      }

      return NextResponse.json({ sync });
    }

    // Get overall status
    const [latestSync, runningSync, stats, recentSyncs] = await Promise.all([
      prisma.eduPortugalSyncLog.findFirst({
        where: { status: 'completed' },
        orderBy: { completedAt: 'desc' },
      }),
      prisma.eduPortugalSyncLog.findFirst({
        where: { status: 'running' },
        orderBy: { startedAt: 'desc' },
      }),
      Promise.all([
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
        prisma.course.groupBy({
          by: ['modality'],
          where: { modality: { not: null } },
          _count: { id: true },
        }),
      ]),
      prisma.eduPortugalSyncLog.findMany({
        orderBy: { startedAt: 'desc' },
        take: 5,
      }),
    ]);

    return NextResponse.json({
      isRunning: !!runningSync,
      runningSync,
      latestSync,
      recentSyncs,
      stats: {
        totalUniversities: stats[0],
        totalCourses: stats[1],
        coursesByLevel: Object.fromEntries(
          stats[2].map((item) => [item.level, item._count.id])
        ),
        universitiesByCity: Object.fromEntries(
          stats[3]
            .filter((item) => item.city)
            .map((item) => [item.city, item._count.id])
        ),
        universitiesByType: Object.fromEntries(
          stats[4]
            .filter((item) => item.type)
            .map((item) => [item.type, item._count.id])
        ),
        coursesByModality: Object.fromEntries(
          stats[5]
            .filter((item) => item.modality)
            .map((item) => [item.modality, item._count.id])
        ),
      },
    });
  } catch (error) {
    console.error('Status error:', error);
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
