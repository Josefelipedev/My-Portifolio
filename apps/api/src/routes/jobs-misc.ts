// Jobs — misc DB-backed domains. Ported from the web app's
// src/app/api/jobs/{analytics,history,alerts} handlers. Query logic kept
// identical (filters/ordering/validation/response shapes). Reads require auth;
// mutations also require CSRF. Cron/aggregator-driven routes (alerts/run,
// alerts/scheduled, alerts/suggestions, api-keys) are deferred to Phase 2.

import { Hono } from 'hono';
import prisma from '../db';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';
import { Errors } from '../lib/api-utils';
import { calculateNextRun, runAlert, runDueAlerts } from '../lib/jobs/alerts-runner';
import { invalidateJobApiKeyCache } from '../lib/jobs/api-keys';
import { generateAlertSuggestions } from '../lib/jobs/alert-suggestions';

const jobsMisc = new Hono<AuthEnv>();

// ============================================================================
// Analytics — GET /jobs/analytics
// ============================================================================

interface FunnelData {
  saved: number;
  applied: number;
  interview: number;
  offer: number;
  rejected: number;
}

interface WeeklyData {
  week: string;
  saved: number;
  applied: number;
}

interface SourceData {
  source: string;
  total: number;
  applied: number;
  interview: number;
  offer: number;
}

interface AnalyticsResponse {
  funnel: FunnelData;
  weeklyActivity: WeeklyData[];
  sourceEffectiveness: SourceData[];
  avgTimeToInterview: number | null;
  topCompanies: { company: string; count: number }[];
  topTags: { tag: string; count: number }[];
  staleJobsCount: number;
  totalSavedJobs: number;
  totalApplications: number;
  recentSearches: number;
}

jobsMisc.get('/jobs/analytics', requireAuth, async (c) => {
  // Get all applications with their status
  const applications = await prisma.jobApplication.findMany({
    select: {
      id: true,
      status: true,
      createdAt: true,
      appliedAt: true,
      savedJob: { select: { source: true, company: true } },
      timeline: true,
    },
  });

  // Get saved jobs count
  const savedJobsCount = await prisma.savedJob.count();

  // Get recent searches count (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentSearchesCount = await prisma.jobSearchHistory.count({
    where: { searchedAt: { gte: thirtyDaysAgo } },
  });

  // Calculate funnel
  const funnel: FunnelData = {
    saved: savedJobsCount,
    applied: applications.filter(
      (a) => a.status === 'applied' || a.status === 'interview' || a.status === 'offer',
    ).length,
    interview: applications.filter((a) => a.status === 'interview' || a.status === 'offer').length,
    offer: applications.filter((a) => a.status === 'offer').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
  };

  // Calculate weekly activity (last 8 weeks)
  const weeklyActivity: WeeklyData[] = [];
  const savedJobs = await prisma.savedJob.findMany({
    select: { savedAt: true },
    where: { savedAt: { gte: new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000) } },
  });

  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - i * 7);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const savedInWeek = savedJobs.filter(
      (job) => new Date(job.savedAt) >= weekStart && new Date(job.savedAt) < weekEnd,
    ).length;

    const appliedInWeek = applications.filter(
      (app) => app.appliedAt && new Date(app.appliedAt) >= weekStart && new Date(app.appliedAt) < weekEnd,
    ).length;

    weeklyActivity.push({ week: weekLabel, saved: savedInWeek, applied: appliedInWeek });
  }

  // Calculate source effectiveness
  const sourceMap = new Map<string, SourceData>();
  for (const app of applications) {
    const source = app.savedJob?.source || 'Unknown';
    if (!sourceMap.has(source)) {
      sourceMap.set(source, { source, total: 0, applied: 0, interview: 0, offer: 0 });
    }
    const data = sourceMap.get(source)!;
    data.total++;
    if (app.status === 'applied' || app.status === 'interview' || app.status === 'offer') data.applied++;
    if (app.status === 'interview' || app.status === 'offer') data.interview++;
    if (app.status === 'offer') data.offer++;
  }

  const sourceEffectiveness = Array.from(sourceMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Calculate average time to interview
  let totalDaysToInterview = 0;
  let interviewCount = 0;
  for (const app of applications) {
    if (app.timeline && app.appliedAt) {
      try {
        const timeline = JSON.parse(app.timeline) as { status: string; date: string }[];
        const interviewEntry = timeline.find((t) => t.status === 'interview');
        if (interviewEntry) {
          const appliedDate = new Date(app.appliedAt);
          const interviewDate = new Date(interviewEntry.date);
          const daysDiff = Math.floor(
            (interviewDate.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (daysDiff >= 0) {
            totalDaysToInterview += daysDiff;
            interviewCount++;
          }
        }
      } catch {
        // Skip invalid timeline
      }
    }
  }

  const avgTimeToInterview =
    interviewCount > 0 ? Math.round(totalDaysToInterview / interviewCount) : null;

  // Get top companies
  const companyCount = new Map<string, number>();
  for (const app of applications) {
    const company = app.savedJob?.company || 'Unknown';
    companyCount.set(company, (companyCount.get(company) || 0) + 1);
  }
  const topCompanies = Array.from(companyCount.entries())
    .map(([company, count]) => ({ company, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Get top tags from saved jobs
  const allSavedJobs = await prisma.savedJob.findMany({
    select: { tags: true, savedAt: true, application: { select: { id: true } } },
  });

  const tagCount = new Map<string, number>();
  for (const job of allSavedJobs) {
    if (!job.tags) continue;
    for (const tag of job.tags.split(',')) {
      const t = tag.trim().toLowerCase();
      if (t.length > 1) tagCount.set(t, (tagCount.get(t) || 0) + 1);
    }
  }
  const topTags = Array.from(tagCount.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Count stale jobs (saved 30+ days ago, no application)
  const staleThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const staleJobsCount = allSavedJobs.filter(
    (j) => !j.application && new Date(j.savedAt) < staleThreshold,
  ).length;

  const response: AnalyticsResponse = {
    funnel,
    weeklyActivity,
    sourceEffectiveness,
    avgTimeToInterview,
    topCompanies,
    topTags,
    staleJobsCount,
    totalSavedJobs: savedJobsCount,
    totalApplications: applications.length,
    recentSearches: recentSearchesCount,
  };

  return c.json(response);
});

// ============================================================================
// Search history — GET / POST / DELETE /jobs/history
// ============================================================================

// GET - Fetch search history (without results blob to keep payload small)
jobsMisc.get('/jobs/history', requireAuth, async (c) => {
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  const history = await prisma.jobSearchHistory.findMany({
    orderBy: { searchedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      keyword: true,
      countries: true,
      sources: true,
      filters: true,
      resultCount: true,
      cachedUntil: true,
      searchedAt: true,
      // exclude results to keep response small
    },
  });

  const now = new Date();
  return c.json(
    history.map((h) => ({
      ...h,
      isCached: h.cachedUntil ? h.cachedUntil > now : false,
    })),
  );
});

// POST - Save a new search to history (legacy — now handled by search route)
jobsMisc.post('/jobs/history', requireAuth, requireCsrf, async (c) => {
  const body = (await c.req.json()) as {
    keyword?: string;
    countries?: string;
    sources?: string;
    filters?: unknown;
    resultCount?: number;
  };
  const { keyword, countries, sources, filters, resultCount } = body;

  if (!keyword) throw Errors.BadRequest('Keyword is required');

  const recentSearch = await prisma.jobSearchHistory.findFirst({
    where: {
      keyword,
      countries,
      sources,
      searchedAt: { gte: new Date(Date.now() - 60 * 1000) },
    },
  });

  if (recentSearch) {
    const updated = await prisma.jobSearchHistory.update({
      where: { id: recentSearch.id },
      data: { resultCount, searchedAt: new Date() },
    });
    return c.json(updated);
  }

  const entry = await prisma.jobSearchHistory.create({
    data: {
      keyword,
      countries: countries || 'all',
      sources: sources || 'all',
      filters: filters ? JSON.stringify(filters) : null,
      resultCount: resultCount || 0,
    },
  });

  return c.json(entry, 201);
});

// DELETE - Clear all history or delete a specific entry
jobsMisc.delete('/jobs/history', requireAuth, requireCsrf, async (c) => {
  const id = c.req.query('id');

  if (id) {
    await prisma.jobSearchHistory.delete({ where: { id } });
    return c.json({ message: 'Entry deleted' });
  }

  // Clear all history
  await prisma.jobSearchHistory.deleteMany({});
  return c.json({ message: 'History cleared' });
});

// ============================================================================
// Job alerts — GET / POST / PUT / DELETE /jobs/alerts (BASE route only)
// ============================================================================

// calculateNextRun lives in lib/jobs/alerts-runner (shared with the runner).

// POST - Run alerts now: a specific alert by id, or every active alert (force).
// Used by the "Run now" button; the VPS cron uses the alerts:run script instead.
jobsMisc.post('/jobs/alerts/run', requireAuth, requireCsrf, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { alertId?: string; id?: string };
  const id = body.alertId || body.id;

  let results;
  if (id) {
    const alert = await prisma.jobAlert.findUnique({ where: { id } });
    if (!alert) throw Errors.NotFound('Alert not found');
    results = [await runAlert(alert)];
  } else {
    results = await runDueAlerts({ force: true });
  }

  const found = results.reduce((n, r) => n + r.found, 0);
  const newMatches = results.reduce((n, r) => n + r.newMatches, 0);
  const emailed = results.some((r) => r.emailed);
  const message = `${found} vaga(s) encontrada(s), ${newMatches} nova(s)${emailed ? ' — e-mail enviado' : ''}.`;
  return c.json({ message, results });
});

// GET /jobs/alerts/suggestions — AI-suggested alerts from the resume. Static
// path, registered before the generic /jobs/alerts handlers.
jobsMisc.get('/jobs/alerts/suggestions', requireAuth, async (c) => {
  const suggestions = await generateAlertSuggestions();
  return c.json({ suggestions, generatedAt: new Date().toISOString() });
});

// GET - Fetch all alerts with recent matches
jobsMisc.get('/jobs/alerts', requireAuth, async (c) => {
  const alerts = await prisma.jobAlert.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      matches: { orderBy: { matchedAt: 'desc' }, take: 5 },
      _count: { select: { matches: true } },
    },
  });

  return c.json(alerts);
});

// POST - Create a new alert
jobsMisc.post('/jobs/alerts', requireAuth, requireCsrf, async (c) => {
  const body = (await c.req.json()) as {
    name?: string;
    keyword?: string;
    countries?: string;
    sources?: string;
    filters?: unknown;
    scheduleEnabled?: boolean;
    scheduleHours?: string;
    scheduleDays?: string;
    emailOnMatch?: boolean;
  };
  const {
    name,
    keyword,
    countries,
    sources,
    filters,
    scheduleEnabled,
    scheduleHours,
    scheduleDays,
    emailOnMatch,
  } = body;

  if (!name || !keyword) throw Errors.BadRequest('Name and keyword are required');

  // Calculate next run if scheduling is enabled
  let nextRun: Date | null = null;
  if (scheduleEnabled && scheduleHours) {
    nextRun = calculateNextRun(scheduleHours, scheduleDays || '');
  }

  const alert = await prisma.jobAlert.create({
    data: {
      name,
      keyword,
      countries: countries || 'all',
      sources: sources || 'all',
      filters: filters ? JSON.stringify(filters) : null,
      scheduleEnabled: scheduleEnabled || false,
      scheduleHours: scheduleHours || null,
      scheduleDays: scheduleDays || null,
      nextRun,
      emailOnMatch: emailOnMatch !== undefined ? emailOnMatch : true,
    },
  });

  return c.json(alert, 201);
});

// PUT - Update an alert
jobsMisc.put('/jobs/alerts', requireAuth, requireCsrf, async (c) => {
  const body = (await c.req.json()) as {
    id?: string;
    name?: string;
    keyword?: string;
    countries?: string;
    sources?: string;
    filters?: unknown;
    isActive?: boolean;
    scheduleEnabled?: boolean;
    scheduleHours?: string;
    scheduleDays?: string;
    emailOnMatch?: boolean;
  };
  const {
    id,
    name,
    keyword,
    countries,
    sources,
    filters,
    isActive,
    scheduleEnabled,
    scheduleHours,
    scheduleDays,
    emailOnMatch,
  } = body;

  if (!id) throw Errors.BadRequest('Alert ID is required');

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (keyword !== undefined) updateData.keyword = keyword;
  if (countries !== undefined) updateData.countries = countries;
  if (sources !== undefined) updateData.sources = sources;
  if (filters !== undefined) updateData.filters = filters ? JSON.stringify(filters) : null;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (scheduleEnabled !== undefined) updateData.scheduleEnabled = scheduleEnabled;
  if (scheduleHours !== undefined) updateData.scheduleHours = scheduleHours || null;
  if (scheduleDays !== undefined) updateData.scheduleDays = scheduleDays || null;
  if (emailOnMatch !== undefined) updateData.emailOnMatch = emailOnMatch;

  // Recalculate next run if scheduling settings changed
  if (scheduleEnabled !== undefined || scheduleHours !== undefined || scheduleDays !== undefined) {
    const finalScheduleEnabled =
      scheduleEnabled !== undefined
        ? scheduleEnabled
        : (await prisma.jobAlert.findUnique({ where: { id } }))?.scheduleEnabled;
    const finalScheduleHours =
      scheduleHours !== undefined
        ? scheduleHours
        : (await prisma.jobAlert.findUnique({ where: { id } }))?.scheduleHours;
    const finalScheduleDays =
      scheduleDays !== undefined
        ? scheduleDays
        : (await prisma.jobAlert.findUnique({ where: { id } }))?.scheduleDays;

    if (finalScheduleEnabled && finalScheduleHours) {
      updateData.nextRun = calculateNextRun(finalScheduleHours, finalScheduleDays || '');
    } else {
      updateData.nextRun = null;
    }
  }

  const alert = await prisma.jobAlert.update({ where: { id }, data: updateData });

  return c.json(alert);
});

// DELETE - Delete an alert
jobsMisc.delete('/jobs/alerts', requireAuth, requireCsrf, async (c) => {
  const id = c.req.query('id');

  if (!id) throw Errors.BadRequest('Alert ID is required');

  await prisma.jobAlert.delete({ where: { id } });

  return c.json({ message: 'Alert deleted' });
});

// ---- job-board API keys (stored in SiteConfig.jobApiKeys, masked on read) ----
const KEY_ENV: Record<string, string> = {
  adzunaAppId: 'ADZUNA_APP_ID',
  adzunaAppKey: 'ADZUNA_APP_KEY',
  joobleApiKey: 'JOOBLE_API_KEY',
  rapidApiKey: 'RAPIDAPI_KEY',
};

function maskKey(val?: string): string | null {
  if (!val) return null;
  return val.length <= 8
    ? '****'
    : `${val.slice(0, 4)}${'*'.repeat(Math.max(4, val.length - 8))}${val.slice(-4)}`;
}

jobsMisc.get('/jobs/api-keys', requireAuth, async (c) => {
  const config = await prisma.siteConfig.findUnique({ where: { id: 'main' } });
  const dbKeys = config?.jobApiKeys ? (JSON.parse(config.jobApiKeys) as Record<string, string>) : {};

  const status = Object.fromEntries(
    Object.entries(KEY_ENV).map(([key, env]) => {
      const dbVal = dbKeys[key];
      return [
        key,
        {
          masked: maskKey(dbVal || process.env[env]),
          source: dbVal ? 'db' : process.env[env] ? 'env' : null,
        },
      ];
    })
  );
  return c.json(status);
});

jobsMisc.put('/jobs/api-keys', requireAuth, requireCsrf, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, string | undefined>;
  const config = await prisma.siteConfig.findUnique({ where: { id: 'main' } });
  const updated: Record<string, string> = config?.jobApiKeys ? JSON.parse(config.jobApiKeys) : {};

  for (const key of Object.keys(KEY_ENV)) {
    const val = body[key];
    if (val === undefined) continue; // not in request — leave unchanged
    if (val === '') delete updated[key]; // empty — remove the override
    else updated[key] = val;
  }

  await prisma.siteConfig.upsert({
    where: { id: 'main' },
    update: { jobApiKeys: JSON.stringify(updated) },
    create: { id: 'main', jobApiKeys: JSON.stringify(updated) },
  });
  invalidateJobApiKeyCache();
  return c.json({ ok: true });
});

export default jobsMisc;
