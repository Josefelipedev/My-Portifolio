import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/admin/agent-tracking - Record a pipeline execution
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { source, keyword, trigger, pipeline, totalDuration, jobsFound } = body;

    // Validate required fields
    if (!source || !keyword || !pipeline || !Array.isArray(pipeline)) {
      return NextResponse.json(
        { error: 'Missing required fields: source, keyword, pipeline' },
        { status: 400 }
      );
    }

    // Determine overall status
    const hasFailedCritical = pipeline.some(
      (p: { agent: string; status: string }) =>
        (p.agent === 'search' || p.agent === 'page') && p.status === 'failed'
    );
    const hasAnyFailure = pipeline.some(
      (p: { status: string }) => p.status === 'failed'
    );

    let status = 'success';
    if (hasFailedCritical || jobsFound === 0) {
      status = 'failed';
    } else if (hasAnyFailure) {
      status = 'partial';
    }

    // Create pipeline execution with agents
    const pipelineExecution = await prisma.pipelineExecution.create({
      data: {
        source,
        keyword,
        totalDurationMs: Math.round((totalDuration || 0) * 1000),
        jobsFound: jobsFound || 0,
        status,
        trigger: trigger || 'manual',
        agents: {
          create: pipeline.map((agent: {
            agent: string;
            status: string;
            duration_seconds: number;
            message?: string;
            error?: string;
            data?: unknown;
          }) => ({
            agentName: agent.agent,
            status: agent.status,
            durationMs: Math.round((agent.duration_seconds || 0) * 1000),
            message: agent.message,
            error: agent.error,
            outputData: agent.data ? JSON.parse(JSON.stringify(agent.data)) : null,
          })),
        },
      },
      include: {
        agents: true,
      },
    });

    return NextResponse.json({
      success: true,
      pipelineId: pipelineExecution.id,
    });
  } catch (error) {
    console.error('Agent tracking POST error:', error);
    return NextResponse.json(
      { error: 'Failed to record pipeline execution' },
      { status: 500 }
    );
  }
}

// GET /api/admin/agent-tracking - Get execution history and stats
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const hours = parseInt(searchParams.get('hours') || '24', 10);

    // Build where clause
    const where: {
      source?: string;
      status?: string;
      createdAt?: { gte: Date };
    } = {};

    if (source) where.source = source;
    if (status) where.status = status;

    // Time filter for stats
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const whereWithTime = { ...where, createdAt: { gte: since } };

    // Fetch data in parallel
    const [pipelines, total, statsRaw, agentStats] = await Promise.all([
      // Recent executions
      prisma.pipelineExecution.findMany({
        where,
        include: {
          agents: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),

      // Total count
      prisma.pipelineExecution.count({ where }),

      // Aggregate stats for time period
      prisma.pipelineExecution.aggregate({
        where: whereWithTime,
        _count: { id: true },
        _avg: { totalDurationMs: true },
        _sum: { jobsFound: true },
      }),

      // Per-agent stats
      prisma.agentExecution.groupBy({
        by: ['agentName'],
        where: {
          createdAt: { gte: since },
        },
        _avg: { durationMs: true },
        _count: { id: true },
      }),
    ]);

    // Calculate success rate
    const successCount = await prisma.pipelineExecution.count({
      where: { ...whereWithTime, status: 'success' },
    });

    const totalInPeriod = statsRaw._count.id || 0;
    const successRate = totalInPeriod > 0 ? (successCount / totalInPeriod) * 100 : 0;

    // Get per-agent success rates
    const agentSuccessCounts = await prisma.agentExecution.groupBy({
      by: ['agentName'],
      where: {
        createdAt: { gte: since },
        status: 'success',
      },
      _count: { id: true },
    });

    // Build agent stats map
    const byAgent: Record<string, { avgDurationMs: number; successRate: number; count: number }> = {};
    for (const stat of agentStats) {
      const successStat = agentSuccessCounts.find((s) => s.agentName === stat.agentName);
      const agentSuccessRate = stat._count.id > 0
        ? ((successStat?._count.id || 0) / stat._count.id) * 100
        : 0;

      byAgent[stat.agentName] = {
        avgDurationMs: Math.round(stat._avg.durationMs || 0),
        successRate: Math.round(agentSuccessRate * 10) / 10,
        count: stat._count.id,
      };
    }

    return NextResponse.json({
      pipelines,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        period: `${hours}h`,
        totalExecutions: totalInPeriod,
        avgDurationMs: Math.round(statsRaw._avg.totalDurationMs || 0),
        successRate: Math.round(successRate * 10) / 10,
        totalJobsFound: statsRaw._sum.jobsFound || 0,
        byAgent,
      },
    });
  } catch (error) {
    console.error('Agent tracking GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent tracking data' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/agent-tracking - Clear old executions
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7', 10);

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await prisma.pipelineExecution.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `Deleted ${result.count} executions older than ${days} days`,
    });
  } catch (error) {
    console.error('Agent tracking DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete old executions' },
      { status: 500 }
    );
  }
}
