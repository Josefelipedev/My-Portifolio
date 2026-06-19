// Job Search Aggregator - Main search function

import type { JobListing, JobSearchParams, JobSource, ApiStatus } from './types';
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
  const push = (name: string, promise: Promise<JobListing[]>) => searches.push({ name, promise });

  // ── Remote-first sources ──
  if (shouldSearchCountry('remote') || isAllCountries) {
    if (isAllSources || sources.includes('remoteok')) push('RemoteOK', searchRemoteOK(params));
    if (isAllSources || sources.includes('remotive')) push('Remotive', searchRemotive(params));
    if (isAllSources || sources.includes('jobicy')) push('Jobicy', searchJobicy(params));
    if (isAllSources || sources.includes('weworkremotely')) push('WeWorkRemotely', searchWeWorkRemotely(params));
  }

  if ((isAllSources || sources.includes('arbeitnow')) && (shouldSearchCountry('pt') || shouldSearchCountry('remote') || isAllCountries)) {
    push('Arbeitnow', searchArbeitnow(params));
  }

  const countriesToSearch = isAllCountries
    ? ['pt', 'br']
    : countries.filter((c) => c !== 'remote' && c !== 'all');

  for (const country of countriesToSearch) {
    const countryParams = { ...params, country };
    if (isAllSources || sources.includes('adzuna')) push(`Adzuna (${country})`, searchAdzuna(countryParams));
    if (isAllSources || sources.includes('jooble')) push(`Jooble (${country})`, searchJooble(countryParams));
    if (isAllSources || sources.includes('jsearch')) push(`JSearch (${country})`, searchJSearch(countryParams));
  }

  if (sources.includes('netempregos') || (isAllSources && shouldSearchCountry('pt'))) push('Net-Empregos', searchNetEmpregos(params));
  if (sources.includes('itjobs') || (isAllSources && shouldSearchCountry('pt'))) push('ITJobs.pt', searchITJobs(params));
  if (sources.includes('buscojobs') || (isAllSources && shouldSearchCountry('pt'))) push('BuscoJobs.pt', searchBuscoJobs(params));
  if (sources.includes('vagascombr') || (isAllSources && shouldSearchCountry('br'))) push('Vagas.com.br', searchVagasComBr(params));
  if (sources.includes('geekhunter') || (isAllSources && shouldSearchCountry('br'))) push('GeekHunter', searchGeekHunter(params));

  if (sources.includes('linkedin') || isAllSources) {
    const linkedinCountries = countriesToSearch.length > 0
      ? countriesToSearch.filter((c) => c === 'br' || c === 'pt')
      : ['br'];
    for (const country of linkedinCountries) push(`LinkedIn (${country})`, searchLinkedIn({ ...params, country }));
  }

  if (sources.includes('gupy') || (isAllSources && shouldSearchCountry('br'))) push('Gupy', searchGupy(params));
  if (sources.includes('catho') || (isAllSources && shouldSearchCountry('br'))) push('Catho', searchCatho(params));
  if (sources.includes('programathor') || (isAllSources && shouldSearchCountry('br'))) push('Programathor', searchProgramathor(params));

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
          error: e instanceof Error ? e.message : String(e),
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
    return cachedResults;
  }

  const searches = buildSourceSearches(params, source);

  const settled = await Promise.allSettled(searches.map(s => s.promise));
  _lastSourceErrors = settled
    .map((r, i) => r.status === 'rejected' ? { source: searches[i].name, error: String((r as PromiseRejectedResult).reason) } : null)
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
    const [remoteok, remotive] = await Promise.all([
      searchRemoteOK(params),
      searchRemotive(params),
    ]);
    const jobs = deduplicateJobs([...remoteok, ...remotive]);
    return jobs.slice(0, limit);
  }

  if (country === 'br' || country === 'pt') {
    params.country = country;
    // Country-specific - use Adzuna, Jooble, JSearch
    const [adzuna, jooble, jsearch, arbeitnow] = await Promise.all([
      searchAdzuna(params),
      searchJooble(params),
      searchJSearch(params),
      country === 'pt' ? searchArbeitnow(params) : Promise.resolve([]),
    ]);
    const jobs = deduplicateJobs([...adzuna, ...jooble, ...jsearch, ...arbeitnow]);
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
  return [
    { name: 'RemoteOK', configured: true, needsKey: false },
    { name: 'Remotive', configured: true, needsKey: false },
    { name: 'Jobicy', configured: true, needsKey: false },
    { name: 'WeWorkRemotely', configured: true, needsKey: false },
    { name: 'Arbeitnow', configured: true, needsKey: false },
    { name: 'Net-Empregos', configured: true, needsKey: false },
    { name: 'ITJobs.pt', configured: true, needsKey: false },
    { name: 'BuscoJobs.pt', configured: true, needsKey: false },
    { name: 'Vagas.com.br', configured: true, needsKey: false },
    { name: 'LinkedIn', configured: true, needsKey: false },
    { name: 'GeekHunter', configured: true, needsKey: false },
    { name: 'Gupy', configured: true, needsKey: false },
    { name: 'Catho', configured: true, needsKey: false },
    { name: 'Programathor', configured: true, needsKey: false },
    { name: 'Python Scraper', configured: hasPythonScraper, needsKey: false },
    { name: 'AI Extraction', configured: hasAIExtraction, needsKey: true },
    { name: 'Adzuna', configured: !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY), needsKey: true },
    { name: 'Jooble', configured: !!process.env.JOOBLE_API_KEY, needsKey: true },
    { name: 'JSearch', configured: !!process.env.RAPIDAPI_KEY, needsKey: true },
  ];
}
