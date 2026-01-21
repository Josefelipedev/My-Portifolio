// Job Cache Layer with Deduplication

import type { JobListing, JobSearchParams, JobSearchResult } from './types';
import { deduplicateJobs } from './deduplication';

/**
 * In-memory cache for job search results
 * In production, this could be replaced with Redis or another caching solution
 */
interface CacheEntry {
  jobs: JobListing[];
  total: number;
  timestamp: number;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate cache key from search parameters
 */
function generateCacheKey(params: JobSearchParams, sources: string[]): string {
  const normalizedParams = {
    keyword: (params.keyword || '').toLowerCase().trim(),
    country: params.country || 'all',
    limit: params.limit || 50,
    maxAgeDays: params.maxAgeDays || 0,
    sources: sources.sort().join(','),
  };
  return JSON.stringify(normalizedParams);
}

/**
 * Get cached results if available and not expired
 */
export function getCachedResults(
  params: JobSearchParams,
  sources: string[]
): JobListing[] | null {
  const key = generateCacheKey(params, sources);
  const entry = cache.get(key);

  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.jobs;
}

/**
 * Store results in cache
 */
export function setCachedResults(
  params: JobSearchParams,
  sources: string[],
  jobs: JobListing[],
  ttl: number = DEFAULT_TTL
): void {
  const key = generateCacheKey(params, sources);
  const now = Date.now();

  cache.set(key, {
    jobs,
    total: jobs.length,
    timestamp: now,
    expiresAt: now + ttl,
  });
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  const entries = Array.from(cache.entries());
  for (const [key, entry] of entries) {
    if (now > entry.expiresAt) {
      cache.delete(key);
    }
  }
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  entries: number;
  totalJobs: number;
  oldestEntry: number | null;
} {
  let totalJobs = 0;
  let oldestEntry: number | null = null;

  const values = Array.from(cache.values());
  for (const entry of values) {
    totalJobs += entry.jobs.length;
    if (oldestEntry === null || entry.timestamp < oldestEntry) {
      oldestEntry = entry.timestamp;
    }
  }

  return {
    entries: cache.size,
    totalJobs,
    oldestEntry,
  };
}

/**
 * Merge and deduplicate jobs from multiple sources
 * Also handles caching of the merged results
 */
export function mergeAndCacheJobs(
  params: JobSearchParams,
  sources: string[],
  jobsBySource: JobListing[][],
  ttl?: number
): JobListing[] {
  // Flatten all jobs
  const allJobs = jobsBySource.flat();

  // Deduplicate
  const deduplicated = deduplicateJobs(allJobs);

  // Cache the results
  setCachedResults(params, sources, deduplicated, ttl);

  return deduplicated;
}

// Run cache cleanup every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(clearExpiredCache, 10 * 60 * 1000);
}
