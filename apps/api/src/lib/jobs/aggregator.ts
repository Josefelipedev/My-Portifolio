// Job Search Aggregator - Main search function

import type { JobListing, JobSearchParams, JobSource, JobSourceType, ApiStatus } from './types';
import { filterJobsByAge, sortJobs } from './helpers';
import { deduplicateJobs } from './deduplication';
import { scoreJobs } from './scoring';
import { getCachedResults, setCachedResults } from './cache';

// Import all API modules
import { searchRemoteOK } from './apis/remoteok';
import { searchRemotive } from './apis/remotive';
import { searchArbeitnow } from './apis/arbeitnow';
import { searchAdzuna } from './apis/adzuna';
import { searchJooble } from './apis/jooble';
import { searchJSearch } from './apis/jsearch';
import { searchNetEmpregos } from './apis/net-empregos';
import { searchITJobs } from './apis/itjobs';
import { searchVagasComBr } from './apis/vagas';
import { searchLinkedIn } from './apis/linkedin';
import { searchGeekHunter } from './apis/geekhunter';
import { searchGupy } from './apis/gupy';
import { searchCatho } from './apis/catho';
import { searchProgramathor } from './apis/programathor';
import { searchJobicy } from './apis/jobicy';
import { searchWeWorkRemotely } from './apis/weworkremotely';
import { searchBuscoJobs } from './apis/buscojobs';
import { isAIExtractionAvailable } from './ai-extraction';
import { isPythonScraperAvailable } from './apis/python-scraper';

export interface SourceError { source: string; error: string }
let _lastSourceErrors: SourceError[] = [];
export function getLastSourceErrors(): SourceError[] { return _lastSourceErrors; }

// Sources this host can't use, e.g. JOBS_DISABLED_SOURCES=buscojobs on the VPS,
// whose datacenter IP gets BuscoJobs' WAF captcha. Read per call so tests can set it.
export function getDisabledSources(): Set<string> {
  return new Set(
    (process.env.JOBS_DISABLED_SOURCES || '')
      .split(',')
      .map((source) => source.trim().toLowerCase())
      .filter(Boolean)
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Resolve to the listings of the sources that succeeded.
async function fulfilled(promises: Promise<JobListing[]>[]): Promise<JobListing[]> {
  const settled = await Promise.allSettled(promises);
  return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

export interface SourceHealth {
  source: string;
  ok: boolean;
  count: number;
  error?: string;
  latencyMs: number;
}

// Build the per-source search promises for the given params/source selection.
// Shared by searchJobs (which merges them) and getSourceHealth (which probes
// each source's status, count, and latency).
function buildSourceSearches(
  params: JobSearchParams,
  source: JobSource | JobSource[]
): { name: string; promise: Promise<JobListing[]> }[] {
  const searches: { name: string; promise: Promise<JobListing[]> }[] = [];
  const sources = Array.isArray(source) ? source : [source];
  const isAllSources = sources.includes('all');
  const countryParam = params.country || 'all';
  const countries = countryParam.includes(',')
    ? countryParam.split(',').filter(Boolean)
    : [countryParam];
  const isAllCountries = countries.includes('all');
  const shouldSearchCountry = (c: string) => isAllCountries || countries.includes(c);
  const disabled = getDisabledSources();
  // Selected explicitly or through 'all'; a disabled source is never searched.
  const want = (type: JobSourceType) => !disabled.has(type) && (isAllSources || sources.includes(type));
  // Country boards: explicit selection, or 'all' when their country is searched.
  const wantIn = (type: JobSourceType, country: string) =>
    !disabled.has(type) && (sources.includes(type) || (isAllSources && shouldSearchCountry(country)));
  const push = (name: string, promise: Promise<JobListing[]>) => searches.push({ name, promise });

  // ── Remote-first sources ──
  if (shouldSearchCountry('remote') || isAllCountries) {
    if (want('remoteok')) push('RemoteOK', searchRemoteOK(params));
    if (want('remotive')) push('Remotive', searchRemotive(params));
    if (want('jobicy')) push('Jobicy', searchJobicy(params));
    if (want('weworkremotely')) push('WeWorkRemotely', searchWeWorkRemotely(params));
  }

  if (want('arbeitnow') && (shouldSearchCountry('pt') || shouldSearchCountry('remote') || isAllCountries)) {
    push('Arbeitnow', searchArbeitnow(params));
  }

  const countriesToSearch = isAllCountries
    ? ['pt', 'br']
    : countries.filter((c) => c !== 'remote' && c !== 'all');

  for (const country of countriesToSearch) {
    const countryParams = { ...params, country };
    if (want('adzuna')) push(`Adzuna (${country})`, searchAdzuna(countryParams));
    if (want('jooble')) push(`Jooble (${country})`, searchJooble(countryParams));
    if (want('jsearch')) push(`JSearch (${country})`, searchJSearch(countryParams));
  }

  if (wantIn('netempregos', 'pt')) push('Net-Empregos', searchNetEmpregos(params));
  if (wantIn('itjobs', 'pt')) push('ITJobs.pt', searchITJobs(params));
  if (wantIn('buscojobs', 'pt')) push('BuscoJobs.pt', searchBuscoJobs(params));
  if (wantIn('vagascombr', 'br')) push('Vagas.com.br', searchVagasComBr(params));
  if (wantIn('geekhunter', 'br')) push('GeekHunter', searchGeekHunter(params));

  if (want('linkedin')) {
    const linkedinCountries = countriesToSearch.length > 0
      ? countriesToSearch.filter((c) => c === 'br' || c === 'pt')
      : ['br'];
    for (const country of linkedinCountries) push(`LinkedIn (${country})`, searchLinkedIn({ ...params, country }));
  }

  if (wantIn('gupy', 'br')) push('Gupy', searchGupy(params));
  if (wantIn('catho', 'br')) push('Catho', searchCatho(params));
  if (wantIn('programathor', 'br')) push('Programathor', searchProgramathor(params));

  return searches;
}

// Probe every selected source and report status, result count, and latency.
// Bypasses the cache so it reflects the sources' real current state.
export async function getSourceHealth(
  params: JobSearchParams,
  source: JobSource | JobSource[] = 'all'
): Promise<SourceHealth[]> {
  const start = Date.now();
  const searches = buildSourceSearches(params, source);
  return Promise.all(
    searches.map(async (s) => {
      try {
        const jobs = await s.promise;
        return { source: s.name, ok: true, count: jobs.length, latencyMs: Date.now() - start };
      } catch (e) {
        return {
          source: s.name,
          ok: false,
          count: 0,
          error: errorMessage(e),
          latencyMs: Date.now() - start,
        };
      }
    })
  );
}

/**
 * Main job search function that aggregates results from multiple sources
 * Accept single source or array of sources, and handle multiple countries
 */
export async function searchJobs(
  params: JobSearchParams,
  source: JobSource | JobSource[] = 'all'
): Promise<JobListing[]> {
  const sources = Array.isArray(source) ? source : [source];
  const isAllSources = sources.includes('all');
  const sourcesList = isAllSources ? ['all'] : sources;

  // Check cache first
  const cachedResults = getCachedResults(params, sourcesList);
  if (cachedResults) {
    _lastSourceErrors = [];
    return cachedResults;
  }

  const searches = buildSourceSearches(params, source);

  // Sources throw on failure (after logging), so a broken source shows up
  // here instead of looking like a source with no matches.
  const settled = await Promise.allSettled(searches.map(s => s.promise));
  _lastSourceErrors = settled
    .map((r, i) => r.status === 'rejected' ? { source: searches[i].name, error: errorMessage(r.reason) } : null)
    .filter((e): e is SourceError => e !== null);

  let allJobs = settled
    .filter((r): r is PromiseFulfilledResult<JobListing[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  // Deduplicate jobs
  allJobs = deduplicateJobs(allJobs);

  // Filter by age if specified
  if (params.maxAgeDays && params.maxAgeDays > 0) {
    allJobs = filterJobsByAge(allJobs, params.maxAgeDays);
  }

  // Sort by date (newest first)
  allJobs = sortJobs(allJobs, 'date');

  // Apply limit to merged results
  if (params.limit) {
    allJobs = allJobs.slice(0, params.limit);
  }

  // Cache results
  setCachedResults(params, sourcesList, allJobs);

  return allJobs;
}

/**
 * Search by country (convenience function)
 */
export async function searchJobsByCountry(
  keyword: string,
  country: 'br' | 'pt' | 'remote' | 'all',
  limit: number = 50
): Promise<JobListing[]> {
  const params: JobSearchParams = { keyword, limit };

  if (country === 'remote') {
    // Remote jobs - use RemoteOK and Remotive
    const jobs = deduplicateJobs(await fulfilled([
      searchRemoteOK(params),
      searchRemotive(params),
    ]));
    return jobs.slice(0, limit);
  }

  if (country === 'br' || country === 'pt') {
    params.country = country;
    // Country-specific - use Adzuna, Jooble, JSearch
    const jobs = deduplicateJobs(await fulfilled([
      searchAdzuna(params),
      searchJooble(params),
      searchJSearch(params),
      country === 'pt' ? searchArbeitnow(params) : Promise.resolve([]),
    ]));
    return jobs.slice(0, limit);
  }

  // All sources
  return searchJobs(params, 'all');
}

/**
 * Get API configuration status
 */
export function getApiStatus(): ApiStatus[] {
  const hasAIExtraction = isAIExtractionAvailable();
  const hasPythonScraper = !!process.env.PYTHON_SCRAPER_URL;
  const disabled = getDisabledSources();
  return [
    { name: 'RemoteOK', configured: !disabled.has('remoteok'), needsKey: false },
    { name: 'Remotive', configured: !disabled.has('remotive'), needsKey: false },
    { name: 'Jobicy', configured: !disabled.has('jobicy'), needsKey: false },
    { name: 'WeWorkRemotely', configured: !disabled.has('weworkremotely'), needsKey: false },
    { name: 'Arbeitnow', configured: !disabled.has('arbeitnow'), needsKey: false },
    { name: 'Net-Empregos', configured: !disabled.has('netempregos'), needsKey: false },
    { name: 'ITJobs.pt', configured: !disabled.has('itjobs'), needsKey: false },
    { name: 'BuscoJobs.pt', configured: !disabled.has('buscojobs'), needsKey: false },
    { name: 'Vagas.com.br', configured: !disabled.has('vagascombr'), needsKey: false },
    { name: 'LinkedIn', configured: !disabled.has('linkedin'), needsKey: false },
    { name: 'GeekHunter', configured: !disabled.has('geekhunter'), needsKey: false },
    { name: 'Gupy', configured: !disabled.has('gupy'), needsKey: false },
    { name: 'Catho', configured: !disabled.has('catho'), needsKey: false },
    { name: 'Programathor', configured: !disabled.has('programathor'), needsKey: false },
    { name: 'Python Scraper', configured: hasPythonScraper, needsKey: false },
    { name: 'AI Extraction', configured: hasAIExtraction, needsKey: true },
    { name: 'Adzuna', configured: !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY), needsKey: true },
    { name: 'Jooble', configured: !!process.env.JOOBLE_API_KEY, needsKey: true },
    { name: 'JSearch', configured: !!process.env.RAPIDAPI_KEY, needsKey: true },
  ];
}
