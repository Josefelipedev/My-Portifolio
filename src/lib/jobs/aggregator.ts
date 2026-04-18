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
import { isAIExtractionAvailable } from './ai-extraction';
import { isPythonScraperAvailable } from './apis/python-scraper';

export interface SourceError { source: string; error: string }
let _lastSourceErrors: SourceError[] = [];
export function getLastSourceErrors(): SourceError[] { return _lastSourceErrors; }

/**
 * Main job search function that aggregates results from multiple sources
 * Accept single source or array of sources, and handle multiple countries
 */
export async function searchJobs(
  params: JobSearchParams,
  source: JobSource | JobSource[] = 'all'
): Promise<JobListing[]> {
  const searches: { name: string; promise: Promise<JobListing[]> }[] = [];

  // Convert to array for easier handling
  const sources = Array.isArray(source) ? source : [source];
  const isAllSources = sources.includes('all');

  // Parse countries (comma-separated string or single value)
  const countryParam = params.country || 'all';
  const countries = countryParam.includes(',')
    ? countryParam.split(',').filter(Boolean)
    : [countryParam];
  const isAllCountries = countries.includes('all');

  // Helper to check if a country should be searched
  const shouldSearchCountry = (c: string) => isAllCountries || countries.includes(c);

  // Check cache first
  const sourcesList = isAllSources ? ['all'] : sources;
  const cachedResults = getCachedResults(params, sourcesList);
  if (cachedResults) {
    return cachedResults;
  }

  const push = (name: string, promise: Promise<JobListing[]>) => searches.push({ name, promise });

  // Remote sources (search if 'remote' or 'all' is selected)
  if (shouldSearchCountry('remote')) {
    if (isAllSources || sources.includes('remoteok')) push('RemoteOK', searchRemoteOK(params));
    if (isAllSources || sources.includes('remotive')) push('Remotive', searchRemotive(params));
  }

  // EU sources
  if ((isAllSources || sources.includes('arbeitnow')) && (shouldSearchCountry('pt') || isAllCountries)) {
    push('Arbeitnow', searchArbeitnow(params));
  }

  // Country-specific sources (Adzuna, Jooble, JSearch)
  // Search each selected country separately for these APIs
  const countriesToSearch = isAllCountries
    ? ['pt', 'br']
    : countries.filter(c => c !== 'remote' && c !== 'all');

  for (const country of countriesToSearch) {
    const countryParams = { ...params, country };
    if (isAllSources || sources.includes('adzuna')) push(`Adzuna (${country})`, searchAdzuna(countryParams));
    if (isAllSources || sources.includes('jooble')) push(`Jooble (${country})`, searchJooble(countryParams));
    if (isAllSources || sources.includes('jsearch')) push(`JSearch (${country})`, searchJSearch(countryParams));
  }

  // Portugal-specific: Net-Empregos
  if (sources.includes('netempregos') || (isAllSources && shouldSearchCountry('pt'))) {
    push('Net-Empregos', searchNetEmpregos(params));
  }

  // Portugal-specific: ITJobs.pt
  if (sources.includes('itjobs') || (isAllSources && shouldSearchCountry('pt'))) {
    push('ITJobs.pt', searchITJobs(params));
  }

  // Brazil-specific: Vagas.com.br (JS scraper with Python fallback)
  if (sources.includes('vagascombr') || (isAllSources && shouldSearchCountry('br'))) {
    push('Vagas.com.br', searchVagasComBr(params));
  }

  // Brazil-specific: GeekHunter (JS scraper with Python fallback)
  if (sources.includes('geekhunter') || (isAllSources && shouldSearchCountry('br'))) {
    push('GeekHunter', searchGeekHunter(params));
  }

  // LinkedIn Jobs (Brazil and Portugal)
  if (sources.includes('linkedin') || isAllSources) {
    for (const country of countriesToSearch) {
      if (country === 'br' || country === 'pt') {
        push(`LinkedIn (${country})`, searchLinkedIn({ ...params, country }));
      }
    }
    if (countriesToSearch.length === 0 || isAllCountries) {
      push('LinkedIn (br)', searchLinkedIn({ ...params, country: 'br' }));
    }
  }

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
    { name: 'Arbeitnow', configured: true, needsKey: false },
    { name: 'Net-Empregos', configured: true, needsKey: false },
    { name: 'ITJobs.pt', configured: true, needsKey: false },
    { name: 'Vagas.com.br', configured: true, needsKey: false },
    { name: 'LinkedIn', configured: true, needsKey: false },
    { name: 'GeekHunter', configured: true, needsKey: false },
    { name: 'Python Scraper', configured: hasPythonScraper, needsKey: false },
    { name: 'AI Extraction', configured: hasAIExtraction, needsKey: true },
    { name: 'Adzuna', configured: !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY), needsKey: true },
    { name: 'Jooble', configured: !!process.env.JOOBLE_API_KEY, needsKey: true },
    { name: 'JSearch', configured: !!process.env.RAPIDAPI_KEY, needsKey: true },
  ];
}
