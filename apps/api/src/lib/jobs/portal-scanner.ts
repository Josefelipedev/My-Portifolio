// ATS Portal Scanner — Greenhouse, Ashby, Lever, SmartRecruiters, Recruitee, custom
// Fetches job listings directly from ATS public APIs. Ported from the web app's
// src/lib/jobs/portal-scanner.ts (prisma import path adjusted for the API).
//
// SmartRecruiters/Recruitee cover the ATSs most Portuguese IT consultancies use;
// the "custom" type falls back to fetching the careers page HTML and extracting
// listings with the AI extractor — so a consultancy with its own career page
// (no structured ATS) is still scannable.

import prisma from '../../db';
import type { JobListing } from './types';
import { extractJobsWithAI, isAIExtractionAvailable } from './ai-extraction';

// Browser-ish UA for the custom HTML fallback (some career pages 403 default UAs).
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Default country filter for country-aware ATSs (SmartRecruiters). This feature
// targets jobs in Portugal; override per-portal with `?country=xx` in careersUrl.
const DEFAULT_PORTAL_COUNTRY = 'pt';

type PortalType = 'greenhouse' | 'ashby' | 'lever' | 'smartrecruiters' | 'recruitee' | 'custom';

export interface TitleFilters {
  include: string[];
  exclude: string[];
  // Optional location allow-list (substring match on the job's location). Use for
  // country-blind ATSs (Greenhouse/Lever/Ashby) to keep only PT-relevant jobs;
  // SmartRecruiters already filters by country=pt so it can omit this.
  location?: string[];
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
  type: PortalType;
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

  // SmartRecruiters: jobs.smartrecruiters.com/{Company} or the API host.
  const smart =
    url.match(/jobs\.smartrecruiters\.com\/([^/?#]+)/) ||
    url.match(/api\.smartrecruiters\.com\/v1\/companies\/([^/?#]+)/);
  if (smart) return { type: 'smartrecruiters', slug: smart[1] };

  // Recruitee: {slug}.recruitee.com
  const recruitee = url.match(/https?:\/\/([^.]+)\.recruitee\.com/);
  if (recruitee) return { type: 'recruitee', slug: recruitee[1] };

  return { type: 'custom', slug: null };
}

// Parse an optional ?country= override out of a careers URL (defaults to PT).
function countryFor(careersUrl: string): string {
  const m = careersUrl.match(/[?&]country=([a-zA-Z]{2})\b/);
  return m ? m[1].toLowerCase() : DEFAULT_PORTAL_COUNTRY;
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

// Keep only jobs whose location matches one of the allow-listed terms. No-op when
// the allow-list is empty/undefined. Jobs without a location are dropped when an
// allow-list is set (we can't confirm they're in scope).
function applyLocationFilter(jobs: JobListing[], location?: string[]): JobListing[] {
  if (!location || location.length === 0) return jobs;
  const terms = location.map((l) => l.toLowerCase());
  return jobs.filter((job) => {
    const loc = (job.location || '').toLowerCase();
    return loc.length > 0 && terms.some((t) => loc.includes(t));
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

// ─── SmartRecruiters ───────────────────────────────────────────────────────────
// Public postings API (no key). Country-filtered (PT by default) because the big
// consultancies on SmartRecruiters (Devoteam, Bosch, Natixis) are multi-country.

interface SmartRecruitersPosting {
  id: string;
  name: string;
  releasedDate?: string;
  location?: { city?: string; country?: string; fullLocation?: string; remote?: boolean; hybrid?: boolean };
  function?: { label?: string };
  department?: { label?: string };
  typeOfEmployment?: { label?: string };
}

// Cap on postings pulled per SmartRecruiters portal per scan (big consultancies
// have hundreds; paginate up to this many, then stop). 100 per page.
const SR_MAX_POSTINGS = 300;

async function fetchSmartRecruitersJobs(
  slug: string,
  company: string,
  filters: TitleFilters,
  careersUrl: string
): Promise<JobListing[]> {
  const country = countryFor(careersUrl);
  const postings: SmartRecruitersPosting[] = [];

  for (let offset = 0; offset < SR_MAX_POSTINGS; offset += 100) {
    const url = `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100&offset=${offset}&country=${country}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      if (offset === 0) throw new Error(`SmartRecruiters API error: ${response.status}`);
      break; // partial page failure — keep what we have
    }
    const data = (await response.json()) as { content?: SmartRecruitersPosting[]; totalFound?: number };
    const page = data.content || [];
    postings.push(...page);
    if (page.length < 100 || postings.length >= (data.totalFound ?? 0)) break;
  }

  const jobs: JobListing[] = postings.map((j) => {
    const jobType = j.location?.remote ? 'Remote' : j.location?.hybrid ? 'Hybrid' : 'On-site';
    return {
      id: `sr-${slug}-${j.id}`,
      source: 'ats' as const,
      title: j.name,
      company,
      description: [j.function?.label, j.department?.label, j.typeOfEmployment?.label]
        .filter(Boolean)
        .join(' · '),
      url: `https://jobs.smartrecruiters.com/${slug}/${j.id}`,
      location: j.location?.fullLocation || j.location?.city,
      jobType,
      postedAt: j.releasedDate ? new Date(j.releasedDate) : undefined,
      country,
    };
  });

  return applyTitleFilters(jobs, filters);
}

// ─── Recruitee ──────────────────────────────────────────────────────────────────

interface RecruiteeOffer {
  id: number;
  title: string;
  careers_url?: string;
  careers_apply_url?: string;
  location?: string;
  city?: string;
  country_code?: string;
  description?: string;
  published_at?: string;
}

async function fetchRecruiteeJobs(
  slug: string,
  company: string,
  filters: TitleFilters
): Promise<JobListing[]> {
  const url = `https://${slug}.recruitee.com/api/offers/`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });

  if (!response.ok) throw new Error(`Recruitee API error: ${response.status}`);

  const data = (await response.json()) as { offers?: RecruiteeOffer[] };

  const jobs: JobListing[] = (data.offers || []).map((j) => ({
    id: `recruitee-${slug}-${j.id}`,
    source: 'ats' as const,
    title: j.title,
    company,
    description: j.description || '',
    url: j.careers_url || j.careers_apply_url || `https://${slug}.recruitee.com/o/${j.id}`,
    location: j.location || j.city,
    postedAt: j.published_at ? new Date(j.published_at) : undefined,
    country: j.country_code ? j.country_code.toLowerCase() : undefined,
  }));

  return applyTitleFilters(jobs, filters);
}

// ─── Custom (AI fallback) ────────────────────────────────────────────────────────
// For consultancies whose careers page is not a recognised ATS: fetch the HTML and
// let the AI extractor pull out listings. Requires a Together API key.

function absolutizeUrl(href: string, base: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

async function fetchCustomJobs(
  careersUrl: string,
  company: string,
  filters: TitleFilters
): Promise<JobListing[]> {
  if (!isAIExtractionAvailable()) {
    throw new Error('custom portal needs TOGETHER_API_KEY for AI extraction');
  }

  const response = await fetch(careersUrl, {
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) throw new Error(`custom fetch error: ${response.status}`);

  const html = await response.text();
  const extracted = await extractJobsWithAI(html, company, careersUrl);

  const jobs: JobListing[] = extracted.map((j, i) => ({
    id: `custom-${slugify(company)}-${i}-${slugify(j.title)}`,
    source: 'ats' as const,
    title: j.title,
    company,
    description: j.description || '',
    url: j.url ? absolutizeUrl(j.url, careersUrl) : careersUrl,
    location: j.location,
    country: DEFAULT_PORTAL_COUNTRY,
  }));

  return applyTitleFilters(jobs, filters);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

// ─── Description Enrichment ──────────────────────────────────────────────────
// The SmartRecruiters list endpoint returns only labels (no job-ad text), which
// starves skill-matching and AI grading. Fetch the per-posting detail to fill in
// the real description. Greenhouse/Lever/Recruitee already include full text.

const ENRICH_CONCURRENCY = 6;

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchSmartRecruitersDescription(url: string): Promise<string | null> {
  const m = url.match(/jobs\.smartrecruiters\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return null;
  const [, slug, id] = m;
  try {
    const res = await fetch(`https://api.smartrecruiters.com/v1/companies/${slug}/postings/${id}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { jobAd?: { sections?: Record<string, { text?: string }> } };
    const s = d.jobAd?.sections || {};
    const text = [s.jobDescription?.text, s.qualifications?.text].filter(Boolean).join('\n\n');
    const clean = stripHtml(text);
    return clean.length > 0 ? clean.slice(0, 4000) : null;
  } catch {
    return null;
  }
}

// Enrich thin job descriptions in place (currently SmartRecruiters). Bounded by
// `max` to cap calls on large deltas; returns how many were enriched and whether
// the cap truncated the work.
export async function enrichDescriptions(
  jobs: JobListing[],
  max = 80
): Promise<{ enriched: number; truncated: number }> {
  const candidates = jobs.filter(
    (j) => /jobs\.smartrecruiters\.com\//.test(j.url) && (j.description || '').length < 200
  );
  const targets = candidates.slice(0, max);
  let enriched = 0;
  for (let i = 0; i < targets.length; i += ENRICH_CONCURRENCY) {
    const chunk = targets.slice(i, i + ENRICH_CONCURRENCY);
    await Promise.all(
      chunk.map(async (job) => {
        const desc = await fetchSmartRecruitersDescription(job.url);
        if (desc) {
          job.description = desc;
          enriched++;
        }
      })
    );
  }
  return { enriched, truncated: Math.max(0, candidates.length - targets.length) };
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

// Fetch (and title-filter) the current jobs for a single portal, dispatching on
// its ATS type. Throws on unsupported types or fetch failures. Exported so the
// discovery agent can validate a candidate portal before persisting it.
export async function fetchPortalJobs(
  portal: { portalType: string; portalSlug: string | null; careersUrl: string; company: string },
  filters: TitleFilters = { include: [], exclude: [] }
): Promise<JobListing[]> {
  const slug = portal.portalSlug || detectPortalType(portal.careersUrl).slug || '';
  let jobs: JobListing[];
  switch (portal.portalType) {
    case 'greenhouse':
      jobs = await fetchGreenhouseJobs(slug, portal.company, filters);
      break;
    case 'ashby':
      jobs = await fetchAshbyJobs(slug, portal.company, filters);
      break;
    case 'lever':
      jobs = await fetchLeverJobs(slug, portal.company, filters);
      break;
    case 'smartrecruiters':
      jobs = await fetchSmartRecruitersJobs(slug, portal.company, filters, portal.careersUrl);
      break;
    case 'recruitee':
      jobs = await fetchRecruiteeJobs(slug, portal.company, filters);
      break;
    case 'custom':
      jobs = await fetchCustomJobs(portal.careersUrl, portal.company, filters);
      break;
    default:
      throw new Error(`Portal type "${portal.portalType}" not supported`);
  }
  return applyLocationFilter(jobs, filters.location);
}

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

      const errors: string[] = [];
      let jobs: JobListing[] = [];

      try {
        jobs = await fetchPortalJobs(portal, filters);
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
