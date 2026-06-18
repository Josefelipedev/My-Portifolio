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

export default wakatime;
