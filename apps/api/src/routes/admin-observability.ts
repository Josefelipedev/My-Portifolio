// Admin observability/analytics — ported from the web app's handlers under
// src/app/api/{admin/logs,admin/ai-usage,admin/agent-tracking,analytics,visits}.
// Query logic and response shapes kept faithful.
//
// Auth posture (matching the web):
//   - logs (GET/DELETE)            -> requireAuth (the web calls isAuthenticated)
//   - analytics (GET/DELETE)       -> requireAuth
//   - visits GET                   -> admin read (requireAuth)
//   - visits POST                  -> PUBLIC page-view tracking (web has NO auth check)
//   - ai-usage (GET/PATCH)         -> the web handler had NO auth check; left public
//                                     for parity (no requireAuth/requireCsrf)
//   - agent-tracking (POST/GET/DELETE) -> the web handler had NO auth check; left
//                                     public for parity
// Mutations that ARE guarded (logs/analytics DELETE) also require CSRF, in line
// with the API service convention for state-changing authed routes.

import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { randomUUID } from 'node:crypto';
import prisma from '../db';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';
import {
  getUsageStats,
  checkQuotaLimits,
  updateQuotaLimits,
  getTodayUsage,
  getMonthUsage,
} from '../lib/ai-tracking';
import { honoCookieOptions } from '../lib/cookies';

const router = new Hono<AuthEnv>();

// ---------------- Admin logs ----------------
router.get('/admin/logs', requireAuth, async (c) => {
  const level = c.req.query('level');
  const source = c.req.query('source');
  const search = c.req.query('search');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  const where: Record<string, unknown> = {};
  if (level && level !== 'all') where.level = level;
  if (source && source !== 'all') where.source = source;
  if (search) where.message = { contains: search, mode: 'insensitive' };
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) (where.createdAt as Record<string, Date>).gte = new Date(startDate);
    if (endDate) (where.createdAt as Record<string, Date>).lte = new Date(endDate);
  }

  const [logs, total] = await Promise.all([
    prisma.systemLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.systemLog.count({ where }),
  ]);

  const stats = await prisma.systemLog.groupBy({
    by: ['level'],
    _count: true,
    where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });

  const sourceStats = await prisma.systemLog.groupBy({
    by: ['source'],
    _count: true,
    where: {
      level: 'error',
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  return c.json({
    logs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    stats: {
      byLevel: stats.reduce(
        (acc, s) => ({ ...acc, [s.level]: s._count }),
        { error: 0, warn: 0, info: 0, debug: 0 },
      ),
      errorsBySource: sourceStats.reduce((acc, s) => ({ ...acc, [s.source]: s._count }), {}),
    },
  });
});

router.delete('/admin/logs', requireAuth, requireCsrf, async (c) => {
  const olderThan = c.req.query('olderThan');
  const level = c.req.query('level');

  const where: Record<string, unknown> = {};
  if (olderThan) where.createdAt = { lt: new Date(olderThan) };
  if (level && level !== 'all') where.level = level;

  const result = await prisma.systemLog.deleteMany({ where });
  return c.json({ deleted: result.count, message: `Deleted ${result.count} log entries` });
});

// ---------------- AI usage (public, mirrors web) ----------------
router.get('/admin/ai-usage', async (c) => {
  const days = parseInt(c.req.query('days') || '7', 10);

  const [stats, quota, today, month] = await Promise.all([
    getUsageStats(days),
    checkQuotaLimits(),
    getTodayUsage(),
    getMonthUsage(),
  ]);

  return c.json({ stats, quota, today, month });
});

router.patch('/admin/ai-usage', async (c) => {
  const body = (await c.req.json()) as {
    dailyLimit?: unknown;
    monthlyLimit?: unknown;
    alertAt?: unknown;
  };
  const { dailyLimit, monthlyLimit, alertAt } = body;

  if (typeof dailyLimit !== 'number' || dailyLimit < 0) {
    return c.json({ error: 'Invalid daily limit' }, 400);
  }
  if (typeof monthlyLimit !== 'number' || monthlyLimit < 0) {
    return c.json({ error: 'Invalid monthly limit' }, 400);
  }

  const alertThreshold = typeof alertAt === 'number' ? alertAt : 0.8;
  if (alertThreshold < 0 || alertThreshold > 1) {
    return c.json({ error: 'Alert threshold must be between 0 and 1' }, 400);
  }

  await updateQuotaLimits(dailyLimit, monthlyLimit, alertThreshold);
  return c.json({ success: true, message: 'Quota limits updated successfully' });
});

// ---------------- Agent tracking (public, mirrors web) ----------------
router.post('/admin/agent-tracking', async (c) => {
  const body = (await c.req.json()) as {
    source?: string;
    keyword?: string;
    trigger?: string;
    pipeline?: unknown;
    totalDuration?: number;
    jobsFound?: number;
  };
  const { source, keyword, trigger, pipeline, totalDuration, jobsFound } = body;

  if (!source || !keyword || !pipeline || !Array.isArray(pipeline)) {
    return c.json({ error: 'Missing required fields: source, keyword, pipeline' }, 400);
  }

  const hasFailedCritical = pipeline.some(
    (p: { agent: string; status: string }) =>
      (p.agent === 'search' || p.agent === 'page') && p.status === 'failed',
  );
  const hasAnyFailure = pipeline.some((p: { status: string }) => p.status === 'failed');

  let status = 'success';
  if (hasFailedCritical || jobsFound === 0) {
    status = 'failed';
  } else if (hasAnyFailure) {
    status = 'partial';
  }

  const pipelineExecution = await prisma.pipelineExecution.create({
    data: {
      source,
      keyword,
      totalDurationMs: Math.round((totalDuration || 0) * 1000),
      jobsFound: jobsFound || 0,
      status,
      trigger: trigger || 'manual',
      agents: {
        create: pipeline.map(
          (agent: {
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
          }),
        ),
      },
    },
    include: { agents: true },
  });

  return c.json({ success: true, pipelineId: pipelineExecution.id });
});

router.get('/admin/agent-tracking', async (c) => {
  const source = c.req.query('source');
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const page = parseInt(c.req.query('page') || '1', 10);
  const hours = parseInt(c.req.query('hours') || '24', 10);

  const where: { source?: string; status?: string; createdAt?: { gte: Date } } = {};
  if (source) where.source = source;
  if (status) where.status = status;

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const whereWithTime = { ...where, createdAt: { gte: since } };

  const [pipelines, total, statsRaw, agentStats] = await Promise.all([
    prisma.pipelineExecution.findMany({
      where,
      include: { agents: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.pipelineExecution.count({ where }),
    prisma.pipelineExecution.aggregate({
      where: whereWithTime,
      _count: { id: true },
      _avg: { totalDurationMs: true },
      _sum: { jobsFound: true },
    }),
    prisma.agentExecution.groupBy({
      by: ['agentName'],
      where: { createdAt: { gte: since } },
      _avg: { durationMs: true },
      _count: { id: true },
    }),
  ]);

  const successCount = await prisma.pipelineExecution.count({
    where: { ...whereWithTime, status: 'success' },
  });

  const totalInPeriod = statsRaw._count.id || 0;
  const successRate = totalInPeriod > 0 ? (successCount / totalInPeriod) * 100 : 0;

  const agentSuccessCounts = await prisma.agentExecution.groupBy({
    by: ['agentName'],
    where: { createdAt: { gte: since }, status: 'success' },
    _count: { id: true },
  });

  const byAgent: Record<string, { avgDurationMs: number; successRate: number; count: number }> = {};
  for (const stat of agentStats) {
    const successStat = agentSuccessCounts.find((s) => s.agentName === stat.agentName);
    const agentSuccessRate =
      stat._count.id > 0 ? ((successStat?._count.id || 0) / stat._count.id) * 100 : 0;

    byAgent[stat.agentName] = {
      avgDurationMs: Math.round(stat._avg.durationMs || 0),
      successRate: Math.round(agentSuccessRate * 10) / 10,
      count: stat._count.id,
    };
  }

  return c.json({
    pipelines,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    stats: {
      period: `${hours}h`,
      totalExecutions: totalInPeriod,
      avgDurationMs: Math.round(statsRaw._avg.totalDurationMs || 0),
      successRate: Math.round(successRate * 10) / 10,
      totalJobsFound: statsRaw._sum.jobsFound || 0,
      byAgent,
    },
  });
});

router.delete('/admin/agent-tracking', async (c) => {
  const days = parseInt(c.req.query('days') || '7', 10);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const result = await prisma.pipelineExecution.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return c.json({
    success: true,
    deleted: result.count,
    message: `Deleted ${result.count} executions older than ${days} days`,
  });
});

// ---------------- Analytics ----------------
router.get('/analytics', requireAuth, async (c) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const stats = await prisma.siteStats.findUnique({ where: { id: 'main' } });

  const todayVisits = await prisma.pageView.count({ where: { createdAt: { gte: today } } });

  const todayUniqueRaw = await prisma.pageView.groupBy({
    by: ['visitorId'],
    where: { createdAt: { gte: today } },
  });
  const todayUnique = todayUniqueRaw.length;

  const last7DaysVisits = await prisma.pageView.findMany({
    where: { createdAt: { gte: last7Days } },
    select: { createdAt: true },
  });

  const visitsByDay: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    visitsByDay[dateStr] = 0;
  }
  last7DaysVisits.forEach((visit) => {
    const dateStr = visit.createdAt.toISOString().split('T')[0];
    if (visitsByDay[dateStr] !== undefined) visitsByDay[dateStr]++;
  });

  const deviceStats = await prisma.pageView.groupBy({
    by: ['device'],
    where: { createdAt: { gte: last30Days } },
    _count: { device: true },
  });

  const browserStats = await prisma.pageView.groupBy({
    by: ['browser'],
    where: { createdAt: { gte: last30Days } },
    _count: { browser: true },
  });

  const osStats = await prisma.pageView.groupBy({
    by: ['os'],
    where: { createdAt: { gte: last30Days } },
    _count: { os: true },
  });

  const referrerStats = await prisma.pageView.groupBy({
    by: ['referrer'],
    where: { createdAt: { gte: last30Days }, referrer: { not: null } },
    _count: { referrer: true },
    orderBy: { _count: { referrer: 'desc' } },
    take: 10,
  });

  const pageStats = await prisma.pageView.groupBy({
    by: ['page'],
    where: { createdAt: { gte: last30Days } },
    _count: { page: true },
    orderBy: { _count: { page: 'desc' } },
    take: 10,
  });

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

  return c.json({
    overview: {
      totalVisits: stats?.totalVisits || 0,
      uniqueVisits: stats?.uniqueVisits || 0,
      todayVisits,
      todayUnique,
    },
    visitsByDay: Object.entries(visitsByDay).map(([date, count]) => ({ date, count })),
    devices: deviceStats.map((d) => ({ name: d.device || 'unknown', count: d._count.device })),
    browsers: browserStats.map((b) => ({ name: b.browser || 'unknown', count: b._count.browser })),
    operatingSystems: osStats.map((o) => ({ name: o.os || 'unknown', count: o._count.os })),
    topReferrers: referrerStats.map((r) => ({ url: r.referrer || 'Direct', count: r._count.referrer })),
    topPages: pageStats.map((p) => ({ page: p.page, count: p._count.page })),
    recentVisits: recentVisits.map((v) => ({
      ...v,
      visitorId: v.visitorId.substring(0, 8) + '...',
    })),
  });
});

router.delete('/analytics', requireAuth, requireCsrf, async (c) => {
  await prisma.pageView.deleteMany({});
  await prisma.siteStats.upsert({
    where: { id: 'main' },
    update: { totalVisits: 0, uniqueVisits: 0 },
    create: { id: 'main', totalVisits: 0, uniqueVisits: 0 },
  });
  return c.json({ success: true, message: 'Analytics data reset successfully' });
});

// ---------------- Visits ----------------
// Anonymize IP address for GDPR/LGPD compliance.
function anonymizeIP(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 3) return parts.slice(0, 3).join(':') + '::0';
    return ip.split(':').slice(0, -2).join(':') + '::0';
  }
  const parts = ip.split('.');
  if (parts.length === 4) {
    parts[3] = '0';
    return parts.join('.');
  }
  return undefined;
}

function parseUserAgent(ua: string | null): { device: string; browser: string; os: string } {
  if (!ua) return { device: 'unknown', browser: 'unknown', os: 'unknown' };

  let device = 'desktop';
  if (/mobile/i.test(ua)) device = 'mobile';
  else if (/tablet|ipad/i.test(ua)) device = 'tablet';

  let browser = 'unknown';
  if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua)) browser = 'Safari';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';

  let os = 'unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';

  return { device, browser, os };
}

// GET - admin read of visit count (task specifies visits GET is admin).
router.get('/visits', requireAuth, async (c) => {
  const stats = await prisma.siteStats.findUnique({ where: { id: 'main' } });
  return c.json({
    totalVisits: stats?.totalVisits || 0,
    uniqueVisits: stats?.uniqueVisits || 0,
  });
});

// POST - PUBLIC page-view tracking (web handler has no auth check).
router.post('/visits', async (c) => {
  let visitorId = getCookie(c, 'visitor_id');
  const isNewVisitor = !visitorId;
  if (!visitorId) visitorId = randomUUID();

  const userAgent = c.req.header('user-agent') || undefined;
  const referrer = c.req.header('referer') || undefined;

  const forwardedFor = c.req.header('x-forwarded-for');
  const realIp = c.req.header('x-real-ip');
  const rawIp = forwardedFor?.split(',')[0]?.trim() || realIp || undefined;
  const ipAddress = anonymizeIP(rawIp);

  const { device, browser, os } = parseUserAgent(userAgent || null);

  let page = '/';
  try {
    const body = (await c.req.json()) as { page?: string };
    page = body.page || '/';
  } catch {
    // No body provided, use default
  }

  const recentVisit = await prisma.pageView.findFirst({
    where: {
      visitorId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  await prisma.pageView.create({
    data: { visitorId, page, referrer, userAgent, ipAddress, device, browser, os },
  });

  const stats = await prisma.siteStats.upsert({
    where: { id: 'main' },
    create: { id: 'main', totalVisits: 1, uniqueVisits: 1 },
    update: {
      totalVisits: { increment: 1 },
      ...(isNewVisitor || !recentVisit ? { uniqueVisits: { increment: 1 } } : {}),
    },
  });

  if (isNewVisitor) {
    setCookie(
      c,
      'visitor_id',
      visitorId,
      honoCookieOptions({
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60,
      }),
    );
  }

  return c.json({
    totalVisits: stats.totalVisits,
    uniqueVisits: stats.uniqueVisits,
    isNewVisitor: isNewVisitor || !recentVisit,
  });
});

export default router;
