// ATS Portal Scanner — Greenhouse, Ashby, Lever
// Fetches job listings directly from ATS public APIs

import prisma from '@/lib/prisma';
import type { JobListing } from './types';

export interface TitleFilters {
  include: string[];
  exclude: string[];
}

export interface PortalScanResult {
  company: string;
  portalType: string;
  newJobs: JobListing[];
  totalFound: number;
  errors: string[];
}

// ─── Portal Type Detection ───────────────────────────────────────────────────

export function detectPortalType(careersUrl: string): {
  type: 'greenhouse' | 'ashby' | 'lever' | 'custom';
  slug: string | null;
} {
  const url = careersUrl.toLowerCase();

  const greenhouse = url.match(/boards\.greenhouse\.io\/([^/?#]+)/);
  if (greenhouse) return { type: 'greenhouse', slug: greenhouse[1] };

  const ashby1 = url.match(/jobs\.ashbyhq\.com\/([^/?#]+)/);
  if (ashby1) return { type: 'ashby', slug: ashby1[1] };

  const ashby2 = url.match(/api\.ashbyhq\.com\/posting-api\/job-board\/([^/?#]+)/);
  if (ashby2) return { type: 'ashby', slug: ashby2[1] };

  const lever = url.match(/jobs\.lever\.co\/([^/?#]+)/);
  if (lever) return { type: 'lever', slug: lever[1] };

  return { type: 'custom', slug: null };
}

// ─── Title Filtering ─────────────────────────────────────────────────────────

function applyTitleFilters(jobs: JobListing[], filters: TitleFilters): JobListing[] {
  return jobs.filter((job) => {
    const title = job.title.toLowerCase();

    if (filters.include.length > 0) {
      const hasInclude = filters.include.some((kw) => title.includes(kw.toLowerCase()));
      if (!hasInclude) return false;
    }

    if (filters.exclude.length > 0) {
      const hasExclude = filters.exclude.some((kw) => title.includes(kw.toLowerCase()));
      if (hasExclude) return false;
    }

    return true;
  });
}

// ─── Greenhouse ───────────────────────────────────────────────────────────────

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location: { name: string };
  updated_at: string;
  content?: string;
}

async function fetchGreenhouseJobs(
  slug: string,
  company: string,
  filters: TitleFilters
): Promise<JobListing[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });

  if (!response.ok) throw new Error(`Greenhouse API error: ${response.status}`);

  const data = (await response.json()) as { jobs: GreenhouseJob[] };

  const jobs: JobListing[] = data.jobs.map((j) => ({
    id: String(j.id),
    source: 'linkedin' as const, // closest generic source
    title: j.title,
    company,
    description: j.content || '',
    url: j.absolute_url,
    location: j.location?.name,
    postedAt: j.updated_at ? new Date(j.updated_at) : undefined,
  }));

  return applyTitleFilters(jobs, filters);
}

// ─── Ashby ────────────────────────────────────────────────────────────────────

interface AshbyPosting {
  id: string;
  title: string;
  jobUrl: string;
  locationName?: string;
  publishedDate?: string;
  descriptionHtml?: string;
}

async function fetchAshbyJobs(
  slug: string,
  company: string,
  filters: TitleFilters
): Promise<JobListing[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 100 }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`Ashby API error: ${response.status}`);

  const data = (await response.json()) as { results: AshbyPosting[] };

  const jobs: JobListing[] = (data.results || []).map((j) => ({
    id: j.id,
    source: 'linkedin' as const,
    title: j.title,
    company,
    description: j.descriptionHtml || '',
    url: j.jobUrl,
    location: j.locationName,
    postedAt: j.publishedDate ? new Date(j.publishedDate) : undefined,
  }));

  return applyTitleFilters(jobs, filters);
}

// ─── Lever ────────────────────────────────────────────────────────────────────

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  categories: { location?: string; commitment?: string };
  createdAt?: number;
  descriptionBody?: string;
}

async function fetchLeverJobs(
  slug: string,
  company: string,
  filters: TitleFilters
): Promise<JobListing[]> {
  const url = `https://api.lever.co/v0/postings/${slug}?mode=json&limit=100`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });

  if (!response.ok) throw new Error(`Lever API error: ${response.status}`);

  const data = (await response.json()) as LeverPosting[];

  const jobs: JobListing[] = data.map((j) => ({
    id: j.id,
    source: 'linkedin' as const,
    title: j.text,
    company,
    description: j.descriptionBody || '',
    url: j.hostedUrl,
    location: j.categories?.location,
    jobType: j.categories?.commitment,
    postedAt: j.createdAt ? new Date(j.createdAt) : undefined,
  }));

  return applyTitleFilters(jobs, filters);
}

// ─── Deduplication ───────────────────────────────────────────────────────────

async function deduplicateAgainstDB(jobs: JobListing[]): Promise<JobListing[]> {
  if (jobs.length === 0) return [];

  const urls = jobs.map((j) => j.url);
  const existing = await prisma.savedJob.findMany({
    where: { url: { in: urls } },
    select: { url: true },
  });

  const existingUrls = new Set(existing.map((j) => j.url));
  return jobs.filter((j) => !existingUrls.has(j.url));
}

// ─── Scan All Portals ─────────────────────────────────────────────────────────

export async function scanAllPortals(): Promise<PortalScanResult[]> {
  const portals = await prisma.companyPortal.findMany({
    where: { isActive: true },
    orderBy: { company: 'asc' },
  });

  if (portals.length === 0) return [];

  const results = await Promise.allSettled(
    portals.map(async (portal): Promise<PortalScanResult> => {
      const filters: TitleFilters = portal.titleFilters
        ? (JSON.parse(portal.titleFilters) as TitleFilters)
        : { include: [], exclude: [] };

      const slug = portal.portalSlug || detectPortalType(portal.careersUrl).slug || '';
      const errors: string[] = [];
      let jobs: JobListing[] = [];

      try {
        if (portal.portalType === 'greenhouse') {
          jobs = await fetchGreenhouseJobs(slug, portal.company, filters);
        } else if (portal.portalType === 'ashby') {
          jobs = await fetchAshbyJobs(slug, portal.company, filters);
        } else if (portal.portalType === 'lever') {
          jobs = await fetchLeverJobs(slug, portal.company, filters);
        } else {
          errors.push(`Portal type "${portal.portalType}" not supported`);
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Unknown fetch error');
      }

      const totalFound = jobs.length;
      const newJobs = await deduplicateAgainstDB(jobs);

      // Update portal stats
      await prisma.companyPortal.update({
        where: { id: portal.id },
        data: {
          lastScannedAt: new Date(),
          lastMatchCount: newJobs.length,
        },
      });

      return {
        company: portal.company,
        portalType: portal.portalType,
        newJobs,
        totalFound,
        errors,
      };
    })
  );

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      company: portals[i].company,
      portalType: portals[i].portalType,
      newJobs: [],
      totalFound: 0,
      errors: [r.reason instanceof Error ? r.reason.message : 'Unknown error'],
    };
  });
}
