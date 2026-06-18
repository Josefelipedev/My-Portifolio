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
import {
  getWakaTimeStats,
  getWakaTimeAllTimeStats,
  getWakaTimeYearlyStats,
  getWakaTimeStatsForYear,
  type WakaTimeStats,
} from '../lib/wakatime';

const wakatime = new Hono();

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

export default wakatime;
