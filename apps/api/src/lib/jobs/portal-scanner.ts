// Company Portal Scanner — Greenhouse, Ashby, Lever and plain careers pages
// Fetches job listings directly from ATS public APIs, or reads the job links
// off a company's own careers page (portal type "custom"). Portals of type
// "manual" are tracked links only: their pages build the job list in the
// browser, so the scan skips them. Ported from the web app's
// src/lib/jobs/portal-scanner.ts (prisma import path adjusted for the API).

import prisma from '../../db';
import { fetchPublicUrl } from '../safe-fetch';
import { BROWSER_HEADERS, parseCareersPageJobs } from './careers-page-parser';
import type { JobListing } from './types';

export const MANUAL_PORTAL_TYPE = 'manual';

export interface TitleFilters {
  include: string[];
  exclude: string[];
}

export interface PortalScanResult {
  company: string;
  portalType: string;
  /** Every listing that passed the title filters on this scan (the feed ingests these). */
  jobs: JobListing[];
  /** The subset not seen on a previous scan of this portal. */
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
    source: 'ats' as const,
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
    source: 'ats' as const,
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
    source: 'ats' as const,
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

// ─── Careers page (custom) ───────────────────────────────────────────────────

async function fetchCareersPageJobs(
  careersUrl: string,
  company: string,
  filters: TitleFilters
): Promise<JobListing[]> {
  const response = await fetchPublicUrl(careersUrl, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`Careers page error: ${response.status}`);

  const html = await response.text();
  const links = parseCareersPageJobs(html, response.url || careersUrl);

  // An empty result is far more often a page that renders its list in the
  // browser (or a changed layout) than a company with no openings at all.
  if (links.length === 0) {
    throw new Error(
      `No job links found on the careers page; if it loads its jobs in the browser, set the portal type to "${MANUAL_PORTAL_TYPE}"`
    );
  }

  const jobs: JobListing[] = links.map((link) => ({
    id: link.url,
    source: 'ats' as const,
    title: link.title,
    company,
    description: '',
    url: link.url,
  }));

  return applyTitleFilters(jobs, filters);
}

// ─── Deduplication ───────────────────────────────────────────────────────────

// Returns the jobs not yet seen in a previous scan of this portal (delta since
// last scan), and records them so the next scan won't re-report them. The first
// scan of a portal reports everything as new once (baseline).
async function deduplicateAndRecord(portalId: string, jobs: JobListing[]): Promise<JobListing[]> {
  if (jobs.length === 0) return [];

  const urls = jobs.map((j) => j.url);
  const seen = await prisma.portalSeenJob.findMany({
    where: { portalId, url: { in: urls } },
    select: { url: true },
  });

  const seenUrls = new Set(seen.map((j) => j.url));
  const newJobs = jobs.filter((j) => !seenUrls.has(j.url));

  if (newJobs.length > 0) {
    await prisma.portalSeenJob.createMany({
      data: newJobs.map((j) => ({ portalId, url: j.url, title: j.title })),
      skipDuplicates: true,
    });
  }

  return newJobs;
}

// ─── Scan All Portals ─────────────────────────────────────────────────────────

export async function scanAllPortals(): Promise<PortalScanResult[]> {
  const portals = await prisma.companyPortal.findMany({
    where: { isActive: true, portalType: { not: MANUAL_PORTAL_TYPE } },
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
        } else if (portal.portalType === 'custom') {
          jobs = await fetchCareersPageJobs(portal.careersUrl, portal.company, filters);
        } else {
          errors.push(`Portal type "${portal.portalType}" not supported`);
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Unknown fetch error');
      }

      const totalFound = jobs.length;
      const newJobs = await deduplicateAndRecord(portal.id, jobs);

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
        jobs,
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
      jobs: [],
      newJobs: [],
      totalFound: 0,
      errors: [r.reason instanceof Error ? r.reason.message : 'Unknown error'],
    };
  });
}
