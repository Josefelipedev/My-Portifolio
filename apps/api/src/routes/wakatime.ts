// Public WakaTime routes — serve the local WakaTimeYearCache table so the
// public homepage can render yearly coding stats without hitting WakaTime.
// Query logic mirrors src/lib/wakatime.ts: getCachedWakaTimeYears() lists the
// cached years (findMany select year, orderBy year desc) and
// getYearStatsFromCache() reads a single year (findUnique by year). There was
// no pre-existing public HTTP handler for these — only the lib functions
// consumed by the RSC section — so these are the cache-read counterparts.
// The JSON-array columns are passed through as stored strings (the web client
// parses them), matching the lib behaviour. Responses match the
// @portfolio/shared contracts.
//
// Phase 2 (deferred: external API / auth):
//   GET  /api/wakatime/preview        — auth + LIVE WakaTime getWakaTimeStats
//   POST /api/wakatime/fetch-rankings — auth + LIVE ranking scraping
//   GET/PUT /api/wakatime/settings    — reads/writes SiteConfig.wakatimeConfig,
//                                        not the cache table (PUT is auth-gated)
// Only the cache-read path is ported below.

import { Hono } from 'hono';
import prisma from '../db';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';
import {
  getWakaTimeStats,
  getWakaTimeAllTimeStats,
  getWakaTimeYearlyStats,
  getWakaTimeStatsForYear,
  type WakaTimeStats,
} from '../lib/wakatime';

const wakatime = new Hono<AuthEnv>();

// Mirrors withCacheHeaders(res, 60, 300) from the web api-utils.
const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

// List the cached years. Mirrors getCachedWakaTimeYears() ordering (desc),
// but returns the full rows so the client can render without a second call.
wakatime.get('/wakatime/years', async (c) => {
  const years = await prisma.wakaTimeYearCache.findMany({
    orderBy: { year: 'desc' },
  });
  c.header('Cache-Control', CACHE_CONTROL);
  return c.json(years);
});

// Single cached year. Mirrors getYearStatsFromCache(year) — findUnique by year.
wakatime.get('/wakatime/years/:year', async (c) => {
  const year = Number(c.req.param('year'));
  if (!Number.isInteger(year)) {
    return c.json({ error: 'Invalid year', code: 'BAD_REQUEST' }, 400);
  }
  const cached = await prisma.wakaTimeYearCache.findUnique({
    where: { year },
  });
  if (!cached) {
    return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404);
  }
  c.header('Cache-Control', CACHE_CONTROL);
  return c.json(cached);
});

// ---- Orchestrated public stats (ported from the RSC WakaTimeStatsSection) ----
// One endpoint that composes config + current/all-time/yearly stats, so the
// Pages homepage renders WakaTime with a single fetch.

const DEFAULT_CONFIG = {
  enabled: true,
  showTotalTime: true, showDailyAverage: true, showBestDay: true, showAllTime: true,
  showLanguages: true, showEditors: true, showOS: true, showProjects: true,
  showYearlyStats: true, showYearSelector: true, selectedYears: [] as number[],
  yearlyStatsType: 'last365' as 'last365' | 'calendar',
  showYearlyTotalTime: true, showYearlyDailyAverage: true, showYearlyBestDay: true,
  showYearlyLanguages: true, showYearlyEditors: true, showYearlyOS: true, showYearlyProjects: true,
  yearlyReportLinks: {}, showYearlyReportLink: true,
  showRankingBadge: true, rankingPercentile: 1, rankingTotalDevs: '500k+',
  yearlyRankings: {
    2023: { percentile: 1, totalDevs: '500k+' },
    2024: { percentile: 1, totalDevs: '500k+' },
    2025: { percentile: 4, totalDevs: '500k+' },
  },
  profileUrl: 'https://wakatime.com/@josefelipedev',
  cacheYearlyData: true,
};

async function getWakaConfig(): Promise<typeof DEFAULT_CONFIG & Record<string, unknown>> {
  try {
    const row = await prisma.siteConfig.findUnique({
      where: { id: 'main' },
      select: { wakatimeConfig: true },
    });
    if (!row?.wakatimeConfig) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...(JSON.parse(row.wakatimeConfig) as Record<string, unknown>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

wakatime.get('/wakatime/stats', async (c) => {
  const config = await getWakaConfig();
  if (!config.enabled) return c.json({ enabled: false });

  const [stats, allTimeStats] = await Promise.all([getWakaTimeStats(), getWakaTimeAllTimeStats()]);
  if (!stats) return c.json({ enabled: false });

  let yearlyStats: WakaTimeStats | null = null;
  const yearlyStatsByYear: Record<number, WakaTimeStats> = {};
  if (config.showYearlyStats) {
    if (config.yearlyStatsType === 'calendar' && config.selectedYears.length > 0) {
      const results = await Promise.all(
        config.selectedYears.map(async (year) => ({ year, data: await getWakaTimeStatsForYear(year) })),
      );
      for (const { year, data } of results) if (data) yearlyStatsByYear[year] = data;
    } else {
      yearlyStats = await getWakaTimeYearlyStats();
    }
  }

  c.header('Cache-Control', CACHE_CONTROL);
  return c.json({ enabled: true, config, stats, allTimeStats, yearlyStats, yearlyStatsByYear });
});

// ---- WakaTime display settings (SiteConfig.wakatimeConfig) ----
interface WakaTimeConfig {
  enabled: boolean;
  showTotalTime: boolean;
  showDailyAverage: boolean;
  showBestDay: boolean;
  showAllTime: boolean;
  showLanguages: boolean;
  showEditors: boolean;
  showOS: boolean;
  showProjects: boolean;
  showYearlyStats: boolean;
  showYearSelector: boolean;
  selectedYears: number[];
  yearlyStatsType: 'last365' | 'calendar';
  showYearlyTotalTime: boolean;
  showYearlyDailyAverage: boolean;
  showYearlyBestDay: boolean;
  showYearlyLanguages: boolean;
  showYearlyEditors: boolean;
  showYearlyOS: boolean;
  showYearlyProjects: boolean;
  yearlyReportLinks: Record<number, string>;
  showYearlyReportLink: boolean;
  showRankingBadge: boolean;
  rankingPercentile: number;
  rankingTotalDevs: string;
  yearlyRankings: Record<number, { percentile: number; totalDevs: string }>;
  profileUrl: string;
  cacheYearlyData: boolean;
}

const DEFAULT_WAKATIME_CONFIG: WakaTimeConfig = {
  enabled: true,
  showTotalTime: true,
  showDailyAverage: true,
  showBestDay: true,
  showAllTime: true,
  showLanguages: true,
  showEditors: true,
  showOS: true,
  showProjects: true,
  showYearlyStats: true,
  showYearSelector: true,
  selectedYears: [],
  yearlyStatsType: 'last365',
  showYearlyTotalTime: true,
  showYearlyDailyAverage: true,
  showYearlyBestDay: true,
  showYearlyLanguages: true,
  showYearlyEditors: true,
  showYearlyOS: true,
  showYearlyProjects: true,
  yearlyReportLinks: {},
  showYearlyReportLink: true,
  showRankingBadge: true,
  rankingPercentile: 1,
  rankingTotalDevs: '500k+',
  yearlyRankings: {
    2023: { percentile: 1, totalDevs: '500k+' },
    2024: { percentile: 1, totalDevs: '500k+' },
    2025: { percentile: 4, totalDevs: '500k+' },
  },
  profileUrl: 'https://wakatime.com/@josefelipedev',
  cacheYearlyData: true,
};

// GET /wakatime/settings — public; returns the saved config merged over defaults.
wakatime.get('/wakatime/settings', async (c) => {
  const cfg = await prisma.siteConfig.findUnique({
    where: { id: 'main' },
    select: { wakatimeConfig: true },
  });
  if (!cfg?.wakatimeConfig) return c.json(DEFAULT_WAKATIME_CONFIG);
  try {
    const parsed = JSON.parse(cfg.wakatimeConfig) as Partial<WakaTimeConfig>;
    return c.json({ ...DEFAULT_WAKATIME_CONFIG, ...parsed });
  } catch {
    return c.json(DEFAULT_WAKATIME_CONFIG);
  }
});

// PUT /wakatime/settings — admin; validates and persists the config.
wakatime.put('/wakatime/settings', requireAuth, requireCsrf, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

  const yearlyReportLinks: Record<number, string> = {};
  if (body.yearlyReportLinks && typeof body.yearlyReportLinks === 'object') {
    for (const [k, v] of Object.entries(body.yearlyReportLinks as Record<string, unknown>)) {
      const year = parseInt(k, 10);
      if (!isNaN(year) && typeof v === 'string' && v.trim()) yearlyReportLinks[year] = v.trim();
    }
  }

  const yearlyRankings: Record<number, { percentile: number; totalDevs: string }> = {};
  if (body.yearlyRankings && typeof body.yearlyRankings === 'object') {
    for (const [k, v] of Object.entries(body.yearlyRankings as Record<string, unknown>)) {
      const year = parseInt(k, 10);
      const r = v as { percentile?: number; totalDevs?: string };
      if (!isNaN(year) && r && typeof r.percentile === 'number' && typeof r.totalDevs === 'string') {
        yearlyRankings[year] = { percentile: r.percentile, totalDevs: r.totalDevs };
      }
    }
  }

  const d = DEFAULT_WAKATIME_CONFIG;
  const newConfig: WakaTimeConfig = {
    enabled: bool(body.enabled, d.enabled),
    showTotalTime: bool(body.showTotalTime, d.showTotalTime),
    showDailyAverage: bool(body.showDailyAverage, d.showDailyAverage),
    showBestDay: bool(body.showBestDay, d.showBestDay),
    showAllTime: bool(body.showAllTime, d.showAllTime),
    showLanguages: bool(body.showLanguages, d.showLanguages),
    showEditors: bool(body.showEditors, d.showEditors),
    showOS: bool(body.showOS, d.showOS),
    showProjects: bool(body.showProjects, d.showProjects),
    showYearlyStats: bool(body.showYearlyStats, d.showYearlyStats),
    showYearSelector: bool(body.showYearSelector, d.showYearSelector),
    selectedYears: Array.isArray(body.selectedYears)
      ? (body.selectedYears as unknown[]).filter((y): y is number => typeof y === 'number')
      : d.selectedYears,
    yearlyStatsType: body.yearlyStatsType === 'calendar' ? 'calendar' : 'last365',
    showYearlyTotalTime: bool(body.showYearlyTotalTime, d.showYearlyTotalTime),
    showYearlyDailyAverage: bool(body.showYearlyDailyAverage, d.showYearlyDailyAverage),
    showYearlyBestDay: bool(body.showYearlyBestDay, d.showYearlyBestDay),
    showYearlyLanguages: bool(body.showYearlyLanguages, d.showYearlyLanguages),
    showYearlyEditors: bool(body.showYearlyEditors, d.showYearlyEditors),
    showYearlyOS: bool(body.showYearlyOS, d.showYearlyOS),
    showYearlyProjects: bool(body.showYearlyProjects, d.showYearlyProjects),
    yearlyReportLinks,
    showYearlyReportLink: bool(body.showYearlyReportLink, d.showYearlyReportLink),
    showRankingBadge: bool(body.showRankingBadge, d.showRankingBadge),
    rankingPercentile: typeof body.rankingPercentile === 'number' ? body.rankingPercentile : d.rankingPercentile,
    rankingTotalDevs: typeof body.rankingTotalDevs === 'string' ? body.rankingTotalDevs : d.rankingTotalDevs,
    yearlyRankings: Object.keys(yearlyRankings).length > 0 ? yearlyRankings : d.yearlyRankings,
    profileUrl: typeof body.profileUrl === 'string' ? body.profileUrl : d.profileUrl,
    cacheYearlyData: bool(body.cacheYearlyData, d.cacheYearlyData),
  };

  const json = JSON.stringify(newConfig);
  await prisma.siteConfig.upsert({
    where: { id: 'main' },
    update: { wakatimeConfig: json },
    create: { id: 'main', wakatimeConfig: json },
  });

  return c.json(newConfig);
});

export default wakatime;
