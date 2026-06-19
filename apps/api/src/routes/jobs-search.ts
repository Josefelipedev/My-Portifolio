// Jobs — live search + smart (resume-based) search. Ported from the web app's
// src/app/api/jobs/{search,smart-search} handlers. Query params and response
// shapes kept faithful. The web routes relied on Next middleware for auth; the
// API service has NO global middleware, so requireAuth is applied explicitly.

import { Hono } from 'hono';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import prisma from '../db';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';
import {
  searchJobs,
  smartJobSearch,
  getApiStatus,
  getLastSourceErrors,
  getSourceHealth,
  type JobSource,
  type JobSearchParams,
  type JobListing,
  type ResumeData,
} from '../lib/jobs';
import { getJobApiKeys } from '../lib/jobs/api-keys';

const jobsSearch = new Hono<AuthEnv>();

const CACHE_TTL_HOURS = parseInt(process.env.JOB_CACHE_TTL_HOURS || '2', 10);

function buildCacheKey(keyword: string, countries: string, sources: string) {
  return {
    keyword: keyword.toLowerCase().trim(),
    countries,
    sources,
  };
}

function resumeJsonPath(): string {
  return process.env.RESUME_JSON_PATH || path.join(process.cwd(), 'data', 'resume.json');
}

/** Load resume: DB first, fallback to file (mirrors the web app's loadResumeData). */
async function loadResumeData(): Promise<ResumeData> {
  try {
    const config = await prisma.resumeConfig.findUnique({ where: { id: 'main' } });
    if (config?.data) {
      return JSON.parse(config.data) as ResumeData;
    }
  } catch {
    // DB not ready or no record — fall through to file
  }
  const content = await fs.readFile(resumeJsonPath(), 'utf-8');
  return JSON.parse(content) as ResumeData;
}

// ---- live search (aggregator) ----
jobsSearch.get('/jobs/search', requireAuth, async (c) => {
  const keyword = c.req.query('keyword') || '';
  const sourceParam = c.req.query('source') || 'all';
  const source: JobSource | JobSource[] = sourceParam.includes(',')
    ? (sourceParam.split(',').filter(Boolean) as JobSource[])
    : (sourceParam as JobSource);
  const country = c.req.query('country') || 'all';
  const location = c.req.query('location') || undefined;
  const category = c.req.query('category') || undefined;
  const maxAgeDays = c.req.query('maxAgeDays') ? parseInt(c.req.query('maxAgeDays')!, 10) : 0;
  const forceRefresh = c.req.query('refresh') === 'true';

  const page = c.req.query('page') ? parseInt(c.req.query('page')!, 10) : 1;
  const pageSize = c.req.query('pageSize') ? parseInt(c.req.query('pageSize')!, 10) : 25;
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : undefined;

  if (c.req.query('status') === 'true') {
    return c.json({ apis: getApiStatus() });
  }

  const countriesKey = country;
  const sourcesKey = Array.isArray(source) ? source.sort().join(',') : source;
  const cacheKey = buildCacheKey(keyword, countriesKey, sourcesKey);

  // ── Check DB cache ───────────────────────────────────────────────────────
  let allJobs: JobListing[] = [];
  let fromCache = false;
  let cacheEntry: { cachedUntil: Date } | null = null;

  if (keyword && !forceRefresh) {
    const entry = await prisma.jobSearchHistory.findFirst({
      where: {
        keyword: cacheKey.keyword,
        countries: cacheKey.countries,
        sources: cacheKey.sources,
        cachedUntil: { gt: new Date() },
        results: { not: null },
      },
      orderBy: { searchedAt: 'desc' },
    });

    if (entry?.results) {
      try {
        allJobs = JSON.parse(entry.results) as JobListing[];
        fromCache = true;
        cacheEntry = { cachedUntil: entry.cachedUntil! };
      } catch {
        // corrupt cache — fall through to live search
      }
    }
  }

  // ── Live search if no valid cache ────────────────────────────────────────
  if (!fromCache) {
    const fetchLimit = limit || 200;
    const params: JobSearchParams = {
      keyword: keyword || undefined,
      location,
      category,
      limit: fetchLimit,
      country,
      maxAgeDays,
    };
    allJobs = await searchJobs(params, source);

    // Persist to DB cache (only when keyword is provided)
    if (keyword) {
      const cachedUntil = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000);
      const resultsJson = JSON.stringify(allJobs);

      const existing = await prisma.jobSearchHistory.findFirst({
        where: {
          keyword: cacheKey.keyword,
          countries: cacheKey.countries,
          sources: cacheKey.sources,
        },
        orderBy: { searchedAt: 'desc' },
      });

      if (existing) {
        await prisma.jobSearchHistory.update({
          where: { id: existing.id },
          data: {
            resultCount: allJobs.length,
            results: resultsJson,
            cachedUntil,
            searchedAt: new Date(),
          },
        });
      } else {
        await prisma.jobSearchHistory.create({
          data: {
            keyword: cacheKey.keyword,
            countries: cacheKey.countries,
            sources: cacheKey.sources,
            resultCount: allJobs.length,
            results: resultsJson,
            cachedUntil,
          },
        });
      }
    }
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  const total = allJobs.length;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedJobs = limit ? allJobs.slice(0, limit) : allJobs.slice(startIndex, endIndex);
  const hasMore = endIndex < total;
  const totalPages = Math.ceil(total / pageSize);

  return c.json({
    jobs: paginatedJobs,
    total,
    page,
    pageSize,
    totalPages,
    hasMore,
    fromCache,
    cachedUntil: fromCache && cacheEntry?.cachedUntil ? cacheEntry.cachedUntil : null,
    sourceErrors: fromCache ? [] : getLastSourceErrors(),
    params: { keyword, source, country, location, category, maxAgeDays, page, pageSize },
    apis: getApiStatus(),
  });
});

// ---- smart search (resume-based) ----
jobsSearch.get('/jobs/smart-search', requireAuth, async (c) => {
  const country = c.req.query('country') || 'all';
  const sourceParam = c.req.query('source') || 'all';
  const source: JobSource | JobSource[] = sourceParam.includes(',')
    ? (sourceParam.split(',').filter(Boolean) as JobSource[])
    : (sourceParam as JobSource);
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : 50;
  const maxAgeDays = c.req.query('maxAgeDays') ? parseInt(c.req.query('maxAgeDays')!, 10) : 0;

  const resume = await loadResumeData();

  const result = await smartJobSearch(resume, { country, source, limit, maxAgeDays });

  // Cache for 5 minutes (matches the web route's withCacheHeaders(300, 600)).
  c.header('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  return c.json({
    jobs: result.jobs,
    total: result.jobs.length,
    keywords: result.keywords,
    resumeName: resume.personalInfo?.name || 'Unknown',
    skillsUsed: resume.skills?.slice(0, 5).map((s) => s.name) || [],
    params: { country, source, limit, maxAgeDays },
    apis: getApiStatus(),
  });
});

// ---- source health: live probe of every job board ----
// GET /jobs/sources/health?keyword=&country= — runs a probe search and reports
// each source's status, result count, latency, and error. Also reports which
// key-gated sources have an API key configured.
jobsSearch.get('/jobs/sources/health', requireAuth, async (c) => {
  const keyword = c.req.query('keyword') || 'developer';
  const country = c.req.query('country') || 'all';

  const [sources, keys] = await Promise.all([
    getSourceHealth({ keyword, country, limit: 50 }),
    getJobApiKeys(),
  ]);

  return c.json({
    probedAt: new Date().toISOString(),
    query: { keyword, country },
    sources: sources.sort((a, b) => Number(b.ok) - Number(a.ok) || a.source.localeCompare(b.source)),
    apiKeys: {
      adzuna: Boolean(keys.adzunaAppId && keys.adzunaAppKey),
      jooble: Boolean(keys.joobleApiKey),
      jsearch: Boolean(keys.rapidApiKey),
    },
  });
});

// ---- jobs resume editor (DB-backed ResumeConfig; used by the Resume tab) ----
jobsSearch.get('/jobs/resume', requireAuth, async (c) => {
  const resume = await loadResumeData();
  return c.json({ resume });
});

jobsSearch.put('/jobs/resume', requireAuth, requireCsrf, async (c) => {
  const body = (await c.req.json().catch(() => null)) as ResumeData | null;
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid resume data', code: 'BAD_REQUEST' }, 400);
  }
  if (!Array.isArray(body.skills)) {
    return c.json({ error: 'skills must be an array', code: 'BAD_REQUEST' }, 400);
  }
  const data = JSON.stringify(body);
  await prisma.resumeConfig.upsert({
    where: { id: 'main' },
    create: { id: 'main', data },
    update: { data },
  });
  return c.json({ success: true, resume: body });
});

export default jobsSearch;
