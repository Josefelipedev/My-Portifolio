import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';

export async function DELETE() {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete all page views
    await prisma.pageView.deleteMany({});

    // Reset site stats
    await prisma.siteStats.upsert({
      where: { id: 'main' },
      update: {
        totalVisits: 0,
        uniqueVisits: 0,
      },
      create: {
        id: 'main',
        totalVisits: 0,
        uniqueVisits: 0,
      },
    });

    return NextResponse.json({ success: true, message: 'Analytics data reset successfully' });
  } catch (error) {
    console.error('Error resetting analytics:', error);
    return NextResponse.json(
      { error: 'Failed to reset analytics' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get overall stats
    const stats = await prisma.siteStats.findUnique({
      where: { id: 'main' },
    });

    // Get today's visits
    const todayVisits = await prisma.pageView.count({
      where: { createdAt: { gte: today } },
    });

    // Get unique visitors today
    const todayUniqueRaw = await prisma.pageView.groupBy({
      by: ['visitorId'],
      where: { createdAt: { gte: today } },
    });
    const todayUnique = todayUniqueRaw.length;

    // Get last 7 days visits by day
    const last7DaysVisits = await prisma.pageView.findMany({
      where: { createdAt: { gte: last7Days } },
      select: { createdAt: true },
    });

    // Group by day
    const visitsByDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      visitsByDay[dateStr] = 0;
    }
    last7DaysVisits.forEach((visit) => {
      const dateStr = visit.createdAt.toISOString().split('T')[0];
      if (visitsByDay[dateStr] !== undefined) {
        visitsByDay[dateStr]++;
      }
    });

    // Get device breakdown
    const deviceStats = await prisma.pageView.groupBy({
      by: ['device'],
      where: { createdAt: { gte: last30Days } },
      _count: { device: true },
    });

    // Get browser breakdown
    const browserStats = await prisma.pageView.groupBy({
      by: ['browser'],
      where: { createdAt: { gte: last30Days } },
      _count: { browser: true },
    });

    // Get OS breakdown
    const osStats = await prisma.pageView.groupBy({
      by: ['os'],
      where: { createdAt: { gte: last30Days } },
      _count: { os: true },
    });

    // Get top referrers
    const referrerStats = await prisma.pageView.groupBy({
      by: ['referrer'],
      where: {
        createdAt: { gte: last30Days },
        referrer: { not: null },
      },
      _count: { referrer: true },
      orderBy: { _count: { referrer: 'desc' } },
      take: 10,
    });

    // Get top pages
    const pageStats = await prisma.pageView.groupBy({
      by: ['page'],
      where: { createdAt: { gte: last30Days } },
      _count: { page: true },
      orderBy: { _count: { page: 'desc' } },
      take: 10,
    });

    // Get recent visits (last 50)
    const recentVisits = await prisma.pageView.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        visitorId: true,
        page: true,
        referrer: true,
        ipAddress: true,
        device: true,
        browser: true,
        os: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      overview: {
        totalVisits: stats?.totalVisits || 0,
        uniqueVisits: stats?.uniqueVisits || 0,
        todayVisits,
        todayUnique,
      },
      visitsByDay: Object.entries(visitsByDay).map(([date, count]) => ({
        date,
        count,
      })),
      devices: deviceStats.map((d) => ({
        name: d.device || 'unknown',
        count: d._count.device,
      })),
      browsers: browserStats.map((b) => ({
        name: b.browser || 'unknown',
        count: b._count.browser,
      })),
      operatingSystems: osStats.map((o) => ({
        name: o.os || 'unknown',
        count: o._count.os,
      })),
      topReferrers: referrerStats.map((r) => ({
        url: r.referrer || 'Direct',
        count: r._count.referrer,
      })),
      topPages: pageStats.map((p) => ({
        page: p.page,
        count: p._count.page,
      })),
      recentVisits: recentVisits.map((v) => ({
        ...v,
        visitorId: v.visitorId.substring(0, 8) + '...', // Truncate for privacy
      })),
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
