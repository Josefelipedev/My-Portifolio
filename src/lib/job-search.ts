// Job Search Library - Integration with multiple job APIs

export interface JobListing {
  id: string;
  source: 'remoteok' | 'remotive' | 'arbeitnow' | 'adzuna' | 'jooble' | 'jsearch';
  title: string;
  company: string;
  companyLogo?: string;
  description: string;
  url: string;
  location?: string;
  jobType?: string;
  salary?: string;
  tags?: string[];
  postedAt?: Date;
  country?: string;
}

export interface JobSearchParams {
  keyword?: string;
  location?: string;
  country?: string; // 'br' | 'pt' | 'us' | 'remote' | etc
  category?: string;
  limit?: number;
}

// ==========================================
// RemoteOK API (Free, no key)
// ==========================================

interface RemoteOKJob {
  id: string;
  slug: string;
  company: string;
  company_logo?: string;
  position: string;
  description: string;
  url: string;
  location?: string;
  tags?: string[];
  salary_min?: number;
  salary_max?: number;
  date: string;
}

export async function searchRemoteOK(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const url = 'https://remoteok.com/api';
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Portfolio Job Search',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`RemoteOK API error: ${response.status}`);
    }

    const data: RemoteOKJob[] = await response.json();
    const jobs = data.slice(1); // First item is legal notice

    let filtered = jobs;
    if (params.keyword) {
      const keyword = params.keyword.toLowerCase();
      filtered = jobs.filter(job =>
        job.position?.toLowerCase().includes(keyword) ||
        job.company?.toLowerCase().includes(keyword) ||
        job.tags?.some(tag => tag.toLowerCase().includes(keyword)) ||
        job.description?.toLowerCase().includes(keyword)
      );
    }

    const limited = filtered.slice(0, params.limit || 50);

    return limited.map(job => ({
      id: `remoteok-${job.id || job.slug}`,
      source: 'remoteok' as const,
      title: job.position || 'Unknown Position',
      company: job.company || 'Unknown Company',
      companyLogo: job.company_logo,
      description: job.description || '',
      url: job.url || `https://remoteok.com/l/${job.slug}`,
      location: job.location || 'Remote',
      jobType: 'Remote',
      salary: formatSalary(job.salary_min, job.salary_max),
      tags: job.tags || [],
      postedAt: job.date ? new Date(job.date) : undefined,
      country: 'remote',
    }));
  } catch (error) {
    console.error('RemoteOK API error:', error);
    return [];
  }
}

// ==========================================
// Remotive API (Free, no key)
// ==========================================

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string;
  category: string;
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary: string;
  description: string;
  tags?: string[];
}

interface RemotiveResponse {
  'job-count': number;
  jobs: RemotiveJob[];
}

export async function searchRemotive(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const url = new URL('https://remotive.com/api/remote-jobs');
    if (params.keyword) {
      url.searchParams.set('search', params.keyword);
    }
    if (params.category) {
      url.searchParams.set('category', params.category);
    }
    if (params.limit) {
      url.searchParams.set('limit', String(params.limit));
    }

    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Remotive API error: ${response.status}`);
    }

    const data: RemotiveResponse = await response.json();

    return data.jobs.map(job => ({
      id: `remotive-${job.id}`,
      source: 'remotive' as const,
      title: job.title,
      company: job.company_name,
      companyLogo: job.company_logo,
      description: job.description,
      url: job.url,
      location: job.candidate_required_location || 'Remote',
      jobType: job.job_type,
      salary: job.salary || undefined,
      tags: job.tags || [job.category],
      postedAt: job.publication_date ? new Date(job.publication_date) : undefined,
      country: 'remote',
    }));
  } catch (error) {
    console.error('Remotive API error:', error);
    return [];
  }
}

// ==========================================
// Arbeitnow API (Free, no key - European tech jobs)
// ==========================================

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string;
  created_at: number;
}

interface ArbeitnowResponse {
  data: ArbeitnowJob[];
  links: { next?: string };
  meta: { total: number };
}

export async function searchArbeitnow(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const url = new URL('https://www.arbeitnow.com/api/job-board-api');

    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Arbeitnow API error: ${response.status}`);
    }

    const data: ArbeitnowResponse = await response.json();
    let jobs = data.data;

    // Filter by keyword
    if (params.keyword) {
      const keyword = params.keyword.toLowerCase();
      jobs = jobs.filter(job =>
        job.title?.toLowerCase().includes(keyword) ||
        job.company_name?.toLowerCase().includes(keyword) ||
        job.tags?.some(tag => tag.toLowerCase().includes(keyword)) ||
        job.description?.toLowerCase().includes(keyword)
      );
    }

    // Filter by location/country for Portugal
    if (params.country === 'pt') {
      jobs = jobs.filter(job =>
        job.location?.toLowerCase().includes('portugal') ||
        job.location?.toLowerCase().includes('lisbon') ||
        job.location?.toLowerCase().includes('porto')
      );
    }

    const limited = jobs.slice(0, params.limit || 50);

    return limited.map(job => ({
      id: `arbeitnow-${job.slug}`,
      source: 'arbeitnow' as const,
      title: job.title,
      company: job.company_name,
      description: job.description,
      url: job.url,
      location: job.location || (job.remote ? 'Remote' : 'Europe'),
      jobType: job.job_types?.join(', ') || (job.remote ? 'Remote' : 'On-site'),
      tags: job.tags || [],
      postedAt: job.created_at ? new Date(job.created_at * 1000) : undefined,
      country: 'eu',
    }));
  } catch (error) {
    console.error('Arbeitnow API error:', error);
    return [];
  }
}

// ==========================================
// Adzuna API (Needs API key - Brazil & Portugal)
// ==========================================

interface AdzunaJob {
  id: string;
  title: string;
  description: string;
  redirect_url: string;
  company: { display_name: string };
  location: { display_name: string; area: string[] };
  salary_min?: number;
  salary_max?: number;
  created: string;
  category: { label: string; tag: string };
}

interface AdzunaResponse {
  results: AdzunaJob[];
  count: number;
}

export async function searchAdzuna(params: JobSearchParams): Promise<JobListing[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    console.log('Adzuna API: Missing credentials (ADZUNA_APP_ID, ADZUNA_APP_KEY)');
    return [];
  }

  try {
    // Adzuna has different endpoints per country
    const countryCode = params.country === 'pt' ? 'pt' : params.country === 'br' ? 'br' : 'gb';
    const url = new URL(`https://api.adzuna.com/v1/api/jobs/${countryCode}/search/1`);

    url.searchParams.set('app_id', appId);
    url.searchParams.set('app_key', appKey);
    url.searchParams.set('results_per_page', String(params.limit || 50));

    if (params.keyword) {
      url.searchParams.set('what', params.keyword);
    }
    if (params.location) {
      url.searchParams.set('where', params.location);
    }

    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Adzuna API error: ${response.status}`);
    }

    const data: AdzunaResponse = await response.json();

    return data.results.map(job => ({
      id: `adzuna-${job.id}`,
      source: 'adzuna' as const,
      title: job.title,
      company: job.company?.display_name || 'Unknown Company',
      description: job.description,
      url: job.redirect_url,
      location: job.location?.display_name || job.location?.area?.join(', '),
      salary: formatSalary(job.salary_min, job.salary_max),
      tags: job.category ? [job.category.label] : [],
      postedAt: job.created ? new Date(job.created) : undefined,
      country: countryCode,
    }));
  } catch (error) {
    console.error('Adzuna API error:', error);
    return [];
  }
}

// ==========================================
// Jooble API (Needs API key - Global)
// ==========================================

interface JoobleJob {
  title: string;
  location: string;
  snippet: string;
  salary: string;
  source: string;
  type: string;
  link: string;
  company: string;
  updated: string;
  id: string;
}

interface JoobleResponse {
  totalCount: number;
  jobs: JoobleJob[];
}

export async function searchJooble(params: JobSearchParams): Promise<JobListing[]> {
  const apiKey = process.env.JOOBLE_API_KEY;

  if (!apiKey) {
    console.log('Jooble API: Missing credential (JOOBLE_API_KEY)');
    return [];
  }

  try {
    // Jooble has different endpoints per country
    const countryDomain = params.country === 'pt' ? 'pt' : params.country === 'br' ? 'br' : 'com';
    const url = `https://jooble.org/api/${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keywords: params.keyword || '',
        location: params.location || '',
        page: 1,
      }),
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Jooble API error: ${response.status}`);
    }

    const data: JoobleResponse = await response.json();
    const jobs = data.jobs?.slice(0, params.limit || 50) || [];

    return jobs.map(job => ({
      id: `jooble-${job.id || Math.random().toString(36).substr(2, 9)}`,
      source: 'jooble' as const,
      title: job.title,
      company: job.company || 'Unknown Company',
      description: job.snippet,
      url: job.link,
      location: job.location,
      jobType: job.type,
      salary: job.salary || undefined,
      tags: [],
      postedAt: job.updated ? new Date(job.updated) : undefined,
      country: params.country || 'global',
    }));
  } catch (error) {
    console.error('Jooble API error:', error);
    return [];
  }
}

// ==========================================
// JSearch API (RapidAPI - Global aggregator)
// ==========================================

interface JSearchJob {
  job_id: string;
  job_title: string;
  employer_name: string;
  employer_logo?: string;
  job_description: string;
  job_apply_link: string;
  job_city: string;
  job_state: string;
  job_country: string;
  job_employment_type: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
  job_posted_at_datetime_utc: string;
  job_required_skills?: string[];
}

interface JSearchResponse {
  status: string;
  data: JSearchJob[];
}

export async function searchJSearch(params: JobSearchParams): Promise<JobListing[]> {
  const apiKey = process.env.RAPIDAPI_KEY;

  if (!apiKey) {
    console.log('JSearch API: Missing credential (RAPIDAPI_KEY)');
    return [];
  }

  try {
    const url = new URL('https://jsearch.p.rapidapi.com/search');

    let query = params.keyword || 'developer';
    if (params.country === 'br') {
      query += ' Brazil';
    } else if (params.country === 'pt') {
      query += ' Portugal';
    }

    url.searchParams.set('query', query);
    url.searchParams.set('num_pages', '1');

    const response = await fetch(url.toString(), {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`JSearch API error: ${response.status}`);
    }

    const data: JSearchResponse = await response.json();
    const jobs = data.data?.slice(0, params.limit || 50) || [];

    return jobs.map(job => ({
      id: `jsearch-${job.job_id}`,
      source: 'jsearch' as const,
      title: job.job_title,
      company: job.employer_name,
      companyLogo: job.employer_logo,
      description: job.job_description,
      url: job.job_apply_link,
      location: [job.job_city, job.job_state, job.job_country].filter(Boolean).join(', '),
      jobType: job.job_employment_type,
      salary: job.job_min_salary && job.job_max_salary
        ? `${job.job_salary_currency || '$'}${formatNumber(job.job_min_salary)} - ${formatNumber(job.job_max_salary)}`
        : undefined,
      tags: job.job_required_skills || [],
      postedAt: job.job_posted_at_datetime_utc ? new Date(job.job_posted_at_datetime_utc) : undefined,
      country: job.job_country?.toLowerCase() || params.country,
    }));
  } catch (error) {
    console.error('JSearch API error:', error);
    return [];
  }
}

// ==========================================
// Combined Search Functions
// ==========================================

export type JobSource = 'all' | 'remoteok' | 'remotive' | 'arbeitnow' | 'adzuna' | 'jooble' | 'jsearch';

export async function searchJobs(params: JobSearchParams, source: JobSource = 'all'): Promise<JobListing[]> {
  const searches: Promise<JobListing[]>[] = [];

  if (source === 'all' || source === 'remoteok') {
    searches.push(searchRemoteOK(params));
  }
  if (source === 'all' || source === 'remotive') {
    searches.push(searchRemotive(params));
  }
  if (source === 'all' || source === 'arbeitnow') {
    searches.push(searchArbeitnow(params));
  }
  if (source === 'all' || source === 'adzuna') {
    searches.push(searchAdzuna(params));
  }
  if (source === 'all' || source === 'jooble') {
    searches.push(searchJooble(params));
  }
  if (source === 'all' || source === 'jsearch') {
    searches.push(searchJSearch(params));
  }

  const results = await Promise.all(searches);
  const allJobs = results.flat();

  // Sort by date (newest first)
  allJobs.sort((a, b) => {
    const dateA = a.postedAt?.getTime() || 0;
    const dateB = b.postedAt?.getTime() || 0;
    return dateB - dateA;
  });

  // Apply limit to merged results
  if (params.limit) {
    return allJobs.slice(0, params.limit);
  }

  return allJobs;
}

// Search by country (convenience function)
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
    return [...remoteok, ...remotive].slice(0, limit);
  }

  if (country === 'br' || country === 'pt') {
    params.country = country;
    // Country-specific - use Adzuna, Jooble, JSearch
    const [adzuna, jooble, jsearch, arbeitnow] = await Promise.all([
      searchAdzuna(params),
      searchJooble(params),
      searchJSearch(params),
      country === 'pt' ? searchArbeitnow(params) : Promise.resolve([]), // Arbeitnow for Portugal
    ]);
    return [...adzuna, ...jooble, ...jsearch, ...arbeitnow].slice(0, limit);
  }

  // All sources
  return searchJobs(params, 'all');
}

// ==========================================
// Helper Functions
// ==========================================

function formatSalary(min?: number, max?: number): string | undefined {
  if (!min && !max) return undefined;
  if (min && max) {
    return `$${formatNumber(min)} - $${formatNumber(max)}`;
  }
  if (min) {
    return `$${formatNumber(min)}+`;
  }
  if (max) {
    return `Up to $${formatNumber(max)}`;
  }
  return undefined;
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${Math.round(num / 1000)}k`;
  }
  return String(num);
}

// ==========================================
// API Status Check
// ==========================================

export function getApiStatus(): { name: string; configured: boolean; needsKey: boolean }[] {
  return [
    { name: 'RemoteOK', configured: true, needsKey: false },
    { name: 'Remotive', configured: true, needsKey: false },
    { name: 'Arbeitnow', configured: true, needsKey: false },
    { name: 'Adzuna', configured: !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY), needsKey: true },
    { name: 'Jooble', configured: !!process.env.JOOBLE_API_KEY, needsKey: true },
    { name: 'JSearch', configured: !!process.env.RAPIDAPI_KEY, needsKey: true },
  ];
}

// Available Remotive categories
export const remotiveCategories = [
  'software-dev',
  'customer-support',
  'design',
  'marketing',
  'sales',
  'product',
  'business',
  'data',
  'devops',
  'finance-legal',
  'hr',
  'qa',
  'writing',
  'all-others',
] as const;

export type RemotiveCategory = typeof remotiveCategories[number];
