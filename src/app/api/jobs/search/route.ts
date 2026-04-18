import { NextResponse } from 'next/server';
import {
  searchJobs,
  getApiStatus,
  type JobSource,
  type JobSearchParams,
  type JobListing,
} from '@/lib/jobs';
import { isAuthenticated } from '@/lib/auth';
import { error } from '@/lib/api-utils';
import prisma from '@/lib/prisma';

const CACHE_TTL_HOURS = parseInt(process.env.JOB_CACHE_TTL_HOURS || '2', 10);

function buildCacheKey(keyword: string, countries: string, sources: string) {
  return {
    keyword: keyword.toLowerCase().trim(),
    countries,
    sources,
  };
}

export async function GET(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const sourceParam = searchParams.get('source') || 'all';
    const source = sourceParam.includes(',')
      ? sourceParam.split(',').filter(Boolean) as JobSource[]
      : sourceParam as JobSource;
    const country = searchParams.get('country') || 'all';
    const location = searchParams.get('location') || undefined;
    const category = searchParams.get('category') || undefined;
    const maxAgeDays = searchParams.get('maxAgeDays') ? parseInt(searchParams.get('maxAgeDays')!) : 0;
    const forceRefresh = searchParams.get('refresh') === 'true';

    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 25;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    if (searchParams.get('status') === 'true') {
      return NextResponse.json({ apis: getApiStatus() });
    }

    const countriesKey = country;
    const sourcesKey = Array.isArray(source) ? source.sort().join(',') : source;
    const cacheKey = buildCacheKey(keyword, countriesKey, sourcesKey);

    // ── Check DB cache ───────────────────────────────────────────────────────
    let allJobs: JobListing[] = [];
    let fromCache = false;
    let cacheEntry = null;

    if (keyword && !forceRefresh) {
      cacheEntry = await prisma.jobSearchHistory.findFirst({
        where: {
          keyword: cacheKey.keyword,
          countries: cacheKey.countries,
          sources: cacheKey.sources,
          cachedUntil: { gt: new Date() },
          results: { not: null },
        },
        orderBy: { searchedAt: 'desc' },
      });

      if (cacheEntry?.results) {
        try {
          allJobs = JSON.parse(cacheEntry.results) as JobListing[];
          fromCache = true;
        } catch {
          // corrupt cache — fall through to live search
        }
      }
    }

    // ── Live search if no valid cache ────────────────────────────────────────
    if (!fromCache) {
      const fetchLimit = limit || 200;
      const params: JobSearchParams = { keyword: keyword || undefined, location, category, limit: fetchLimit, country, maxAgeDays };
      allJobs = await searchJobs(params, source);

      // Persist to DB cache (only when keyword is provided)
      if (keyword) {
        const cachedUntil = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000);
        const resultsJson = JSON.stringify(allJobs);

        // Update existing entry or create new one
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

    return NextResponse.json({
      jobs: paginatedJobs,
      total,
      page,
      pageSize,
      totalPages,
      hasMore,
      fromCache,
      cachedUntil: fromCache && cacheEntry?.cachedUntil ? cacheEntry.cachedUntil : null,
      params: { keyword, source, country, location, category, maxAgeDays, page, pageSize },
      apis: getApiStatus(),
    });
  } catch (err) {
    return error(err);
  }
}
