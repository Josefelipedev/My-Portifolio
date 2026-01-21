import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level'); // 'error', 'warn', 'info', 'debug'
    const source = searchParams.get('source');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    const where: Record<string, unknown> = {};

    if (level && level !== 'all') {
      where.level = level;
    }

    if (source && source !== 'all') {
      where.source = source;
    }

    if (search) {
      where.message = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.createdAt as Record<string, Date>).lte = new Date(endDate);
      }
    }

    // Fetch logs with pagination
    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.systemLog.count({ where }),
    ]);

    // Get stats
    const stats = await prisma.systemLog.groupBy({
      by: ['level'],
      _count: true,
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    const sourceStats = await prisma.systemLog.groupBy({
      by: ['source'],
      _count: true,
      where: {
        level: 'error',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: {
        byLevel: stats.reduce(
          (acc, s) => ({ ...acc, [s.level]: s._count }),
          { error: 0, warn: 0, info: 0, debug: 0 }
        ),
        errorsBySource: sourceStats.reduce(
          (acc, s) => ({ ...acc, [s.source]: s._count }),
          {}
        ),
      },
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const olderThan = searchParams.get('olderThan'); // ISO date string
    const level = searchParams.get('level');

    const where: Record<string, unknown> = {};

    if (olderThan) {
      where.createdAt = { lt: new Date(olderThan) };
    }

    if (level && level !== 'all') {
      where.level = level;
    }

    const result = await prisma.systemLog.deleteMany({ where });

    return NextResponse.json({
      deleted: result.count,
      message: `Deleted ${result.count} log entries`,
    });
  } catch (error) {
    console.error('Error deleting logs:', error);
    return NextResponse.json(
      { error: 'Failed to delete logs' },
      { status: 500 }
    );
  }
}
