// Job Search Library - Integration with multiple job APIs
import Together from 'together-ai';

// ==========================================
// AI-powered HTML Job Extraction
// ==========================================

interface AIExtractedJob {
  title: string;
  company: string;
  location: string;
  url: string;
  level?: string;
  description?: string;
}

// Get Together AI client for job extraction
let togetherClientForJobs: Together | null = null;

function getTogetherClientForJobs(): Together | null {
  if (!togetherClientForJobs) {
    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) {
      return null;
    }
    togetherClientForJobs = new Together({ apiKey });
  }
  return togetherClientForJobs;
}

// Extract jobs from HTML using AI
async function extractJobsWithAI(
  html: string,
  siteName: string,
  baseUrl: string
): Promise<AIExtractedJob[]> {
  const client = getTogetherClientForJobs();
  if (!client) {
    console.log('AI extraction: No Together API key configured, using regex fallback');
    return [];
  }

  try {
    // Clean HTML - remove scripts, styles, and excessive whitespace
    const cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 15000); // Limit to ~15k chars for AI context

    const prompt = `You are a job listing extractor. Analyze this HTML from ${siteName} and extract job listings.

HTML Content:
${cleanedHtml}

Extract job listings and return a JSON array with this structure:
[
  {
    "title": "Job title",
    "company": "Company name",
    "location": "City/Location",
    "url": "Job URL (relative or absolute)",
    "level": "Experience level if available (Junior, Pleno, Senior)",
    "description": "Brief description if available"
  }
]

IMPORTANT:
- Extract ALL visible job listings from the HTML
- For URLs, include the path as found (e.g., "/vagas/v123/job-title")
- If company is not found, use empty string
- If location is not found, use "Brasil" for Vagas.com.br or "Portugal" for Net-Empregos
- Return ONLY the JSON array, no other text
- If no jobs found, return empty array []

Respond with ONLY the JSON array.`;

    const response = await client.chat.completions.create({
      model: process.env.TOGETHER_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.1, // Low temperature for consistent extraction
    });

    const content = response.choices[0]?.message?.content?.trim() || '[]';

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('AI extraction: No JSON array found in response');
      return [];
    }

    const jobs = JSON.parse(jsonMatch[0]) as AIExtractedJob[];
    console.log(`AI extraction: Found ${jobs.length} jobs from ${siteName}`);
    return jobs;
  } catch (error) {
    console.error('AI extraction error:', error);
    return [];
  }
}

export interface JobListing {
  id: string;
  source: 'remoteok' | 'remotive' | 'arbeitnow' | 'adzuna' | 'jooble' | 'jsearch' | 'netempregos' | 'vagascombr' | 'linkedin';
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
  maxAgeDays?: number; // Filter jobs older than X days (0 = no filter)
}

// Filter jobs by age (days)
export function filterJobsByAge(jobs: JobListing[], maxAgeDays: number): JobListing[] {
  if (!maxAgeDays || maxAgeDays <= 0) return jobs;

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);

  return jobs.filter(job => {
    if (!job.postedAt) return true; // Keep jobs without date (we don't know how old they are)
    const jobDate = new Date(job.postedAt);
    return jobDate >= cutoffDate;
  });
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

export type JobSource = 'all' | 'remoteok' | 'remotive' | 'arbeitnow' | 'adzuna' | 'jooble' | 'jsearch' | 'netempregos' | 'vagascombr' | 'linkedin';

// Accept single source or array of sources, and handle multiple countries
export async function searchJobs(params: JobSearchParams, source: JobSource | JobSource[] = 'all'): Promise<JobListing[]> {
  const searches: Promise<JobListing[]>[] = [];

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

  // Remote sources (search if 'remote' or 'all' is selected)
  if (shouldSearchCountry('remote')) {
    if (isAllSources || sources.includes('remoteok')) {
      searches.push(searchRemoteOK(params));
    }
    if (isAllSources || sources.includes('remotive')) {
      searches.push(searchRemotive(params));
    }
  }

  // EU sources
  if (isAllSources || sources.includes('arbeitnow')) {
    if (shouldSearchCountry('pt') || isAllCountries) {
      searches.push(searchArbeitnow(params));
    }
  }

  // Country-specific sources (Adzuna, Jooble, JSearch)
  // Search each selected country separately for these APIs
  const countriesToSearch = isAllCountries ? ['pt', 'br'] : countries.filter(c => c !== 'remote' && c !== 'all');

  for (const country of countriesToSearch) {
    const countryParams = { ...params, country };

    if (isAllSources || sources.includes('adzuna')) {
      searches.push(searchAdzuna(countryParams));
    }
    if (isAllSources || sources.includes('jooble')) {
      searches.push(searchJooble(countryParams));
    }
    if (isAllSources || sources.includes('jsearch')) {
      searches.push(searchJSearch(countryParams));
    }
  }

  // Portugal-specific: Net-Empregos
  if (sources.includes('netempregos') || (isAllSources && shouldSearchCountry('pt'))) {
    searches.push(searchNetEmpregos(params));
  }

  // Brazil-specific: Vagas.com.br
  if (sources.includes('vagascombr') || (isAllSources && shouldSearchCountry('br'))) {
    searches.push(searchVagasComBr(params));
  }

  // LinkedIn Jobs (Brazil and Portugal)
  if (sources.includes('linkedin') || isAllSources) {
    // Search for each selected country
    for (const country of countriesToSearch) {
      if (country === 'br' || country === 'pt') {
        searches.push(searchLinkedIn({ ...params, country }));
      }
    }
    // If no specific country, default to Brazil
    if (countriesToSearch.length === 0 || isAllCountries) {
      searches.push(searchLinkedIn({ ...params, country: 'br' }));
    }
  }

  const results = await Promise.all(searches);
  let allJobs = results.flat();

  // Filter by age if specified
  if (params.maxAgeDays && params.maxAgeDays > 0) {
    allJobs = filterJobsByAge(allJobs, params.maxAgeDays);
  }

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
  const hasAIExtraction = !!process.env.TOGETHER_API_KEY;
  return [
    { name: 'RemoteOK', configured: true, needsKey: false },
    { name: 'Remotive', configured: true, needsKey: false },
    { name: 'Arbeitnow', configured: true, needsKey: false },
    { name: 'Net-Empregos', configured: true, needsKey: false },
    { name: 'Vagas.com.br', configured: true, needsKey: false },
    { name: 'LinkedIn', configured: true, needsKey: false },
    { name: 'AI Extraction', configured: hasAIExtraction, needsKey: true },
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

// ==========================================
// Net-Empregos Web Scraping (Portugal)
// ==========================================

interface NetEmpregosJob {
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  date: string;
}

export async function searchNetEmpregos(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const keyword = encodeURIComponent(params.keyword || 'developer');
    const url = `https://www.net-empregos.com/pesquisa-empregos.asp?chaves=${keyword}&categoria=0`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Net-Empregos fetch error: ${response.status}`);
    }

    const html = await response.text();

    // Try AI extraction first
    let jobs: NetEmpregosJob[] = [];
    const aiJobs = await extractJobsWithAI(html, 'Net-Empregos', 'https://www.net-empregos.com');

    if (aiJobs.length > 0) {
      // Use AI-extracted jobs
      jobs = aiJobs.map(job => ({
        title: job.title,
        company: job.company,
        location: job.location || 'Portugal',
        url: job.url,
        description: job.description || '',
        date: '',
      }));
    } else {
      // Fallback to regex parsing
      console.log('Net-Empregos: AI extraction failed, using regex fallback');
      jobs = parseNetEmpregosHTML(html);
    }

    return jobs.slice(0, params.limit || 50).map((job, index) => ({
      id: `netempregos-${Date.now()}-${index}`,
      source: 'netempregos' as const,
      title: job.title,
      company: job.company || 'Empresa não identificada',
      description: job.description || '',
      url: job.url.startsWith('http') ? job.url : `https://www.net-empregos.com${job.url}`,
      location: job.location || 'Portugal',
      jobType: 'On-site',
      tags: [],
      postedAt: parseNetEmpregosDate(job.date),
      country: 'pt',
    }));
  } catch (error) {
    console.error('Net-Empregos scraping error:', error);
    return [];
  }
}

function parseNetEmpregosHTML(html: string): NetEmpregosJob[] {
  const jobs: NetEmpregosJob[] = [];

  // New pattern: <h2><a class="oferta-link" href="/ID/TITLE/">TITLE</a></h2>
  // Pattern for job items with h2 titles
  const jobPattern = /<h2[^>]*>[\s\S]*?<a[^>]*class="oferta-link"[^>]*href=["']?([^"'\s>]+)["']?[^>]*>([^<]+)<\/a>/gi;

  let match;
  while ((match = jobPattern.exec(html)) !== null) {
    const url = match[1].replace(/^=/, ''); // Remove leading = if present
    const title = cleanHtmlText(match[2]);

    if (title && title.length > 3) {
      // Find the job-item container around this match to extract company and location
      const contextStart = Math.max(0, match.index - 100);
      const contextEnd = Math.min(html.length, match.index + 800);
      const context = html.substring(contextStart, contextEnd);

      // Extract company from <li><i class="flaticon-work"></i> COMPANY</li>
      const companyMatch = context.match(/flaticon-work[^>]*><\/i>\s*([^<]+)</i);
      const company = companyMatch ? cleanHtmlText(companyMatch[1]) : '';

      // Extract location from <i class="flaticon-location"></i> LOCATION
      const localMatch = context.match(/flaticon-location[^>]*><\/i>\s*([^<]+)</i);
      const location = localMatch ? cleanHtmlText(localMatch[1]) : 'Portugal';

      // Extract date - look for patterns like "há X dias" or date format
      const dateMatch = context.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
      const date = dateMatch ? dateMatch[1] : '';

      jobs.push({
        title,
        company,
        location,
        url: url.startsWith('/') ? url : `/${url}`,
        description: '',
        date,
      });
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return jobs.filter(job => {
    if (seen.has(job.url)) return false;
    seen.add(job.url);
    return true;
  });
}

function cleanHtmlText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNetEmpregosDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;

  // Try to parse common Portuguese date formats (DD-MM-YYYY or DD/MM/YYYY)
  const match = dateStr.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }

  return undefined;
}

// ==========================================
// Vagas.com.br Web Scraping (Brazil)
// ==========================================

interface VagasComBrJob {
  title: string;
  company: string;
  location: string;
  url: string;
  level: string;
}

export async function searchVagasComBr(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const keyword = encodeURIComponent(params.keyword || 'desenvolvedor');
    const url = `https://www.vagas.com.br/vagas-de-${keyword.replace(/%20/g, '-')}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Vagas.com.br fetch error: ${response.status}`);
    }

    const html = await response.text();

    // Try AI extraction first
    let jobs: VagasComBrJob[] = [];
    const aiJobs = await extractJobsWithAI(html, 'Vagas.com.br', 'https://www.vagas.com.br');

    if (aiJobs.length > 0) {
      // Use AI-extracted jobs
      jobs = aiJobs.map(job => ({
        title: job.title,
        company: job.company,
        location: job.location || 'Brasil',
        url: job.url,
        level: job.level || '',
      }));
    } else {
      // Fallback to regex parsing
      console.log('Vagas.com.br: AI extraction failed, using regex fallback');
      jobs = parseVagasComBrHTML(html);
    }

    return jobs.slice(0, params.limit || 50).map((job, index) => ({
      id: `vagascombr-${Date.now()}-${index}`,
      source: 'vagascombr' as const,
      title: job.title,
      company: job.company || 'Empresa confidencial',
      description: job.level ? `Nivel: ${job.level}` : '',
      url: job.url.startsWith('http') ? job.url : `https://www.vagas.com.br${job.url}`,
      location: job.location || 'Brasil',
      jobType: 'On-site',
      tags: job.level ? [job.level] : [],
      postedAt: undefined,
      country: 'br',
    }));
  } catch (error) {
    console.error('Vagas.com.br scraping error:', error);
    return [];
  }
}

function parseVagasComBrHTML(html: string): VagasComBrJob[] {
  const jobs: VagasComBrJob[] = [];

  // Pattern: <a class="link-detalhes-vaga" data-id-vaga="ID" title="TITULO" href="/vagas/vID/slug">
  const jobPattern = /<a[^>]*class="link-detalhes-vaga"[^>]*data-id-vaga="(\d+)"[^>]*title="([^"]+)"[^>]*href="([^"]+)"/gi;

  let match;
  while ((match = jobPattern.exec(html)) !== null) {
    const vagaId = match[1];
    const title = cleanHtmlText(match[2]);
    const url = match[3];

    if (title && title.length > 3) {
      // Find company and level in surrounding context
      const contextStart = Math.max(0, match.index);
      const contextEnd = Math.min(html.length, match.index + 1000);
      const context = html.substring(contextStart, contextEnd);

      // Extract company from <span class="emprVaga">COMPANY</span>
      const companyMatch = context.match(/<span[^>]*class="emprVaga"[^>]*>\s*([^<]+)/i);
      const company = companyMatch ? cleanHtmlText(companyMatch[1]) : '';

      // Extract level from <span class="nivelVaga">LEVEL</span>
      const levelMatch = context.match(/<span[^>]*class="nivelVaga"[^>]*>\s*([^<]+)/i);
      const level = levelMatch ? cleanHtmlText(levelMatch[1]) : '';

      // Extract location from <div class="vaga-local"> (may contain icon before text)
      const locationMatch = context.match(/<div[^>]*class="vaga-local"[^>]*>[\s\S]*?<\/i>\s*([^<]+)/i) ||
                           context.match(/<div[^>]*class="vaga-local"[^>]*>\s*([^<]+)/i);
      const location = locationMatch ? cleanHtmlText(locationMatch[1]) : 'Brasil';

      jobs.push({
        title,
        company,
        location,
        url,
        level,
      });
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return jobs.filter(job => {
    if (seen.has(job.url)) return false;
    seen.add(job.url);
    return true;
  });
}

// ==========================================
// LinkedIn Jobs (Brazil/Portugal) - Guest API
// ==========================================

export async function searchLinkedIn(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const keyword = encodeURIComponent(params.keyword || 'desenvolvedor');
    const location = params.country === 'pt' ? 'Portugal' : 'Brazil';
    const geoId = params.country === 'pt' ? '100364837' : '106057199'; // Portugal or Brazil geoId

    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${keyword}&location=${location}&geoId=${geoId}&start=0&sortBy=R`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`LinkedIn fetch error: ${response.status}`);
    }

    const html = await response.text();
    const jobs = parseLinkedInHTML(html, params.country || 'br');

    return jobs.slice(0, params.limit || 50);
  } catch (error) {
    console.error('LinkedIn scraping error:', error);
    return [];
  }
}

function parseLinkedInHTML(html: string, country: string): JobListing[] {
  const jobs: JobListing[] = [];
  const cards = html.split('<li').slice(1);

  cards.forEach((card, index) => {
    const titleMatch = card.match(/base-search-card__title[^>]*>([^<]+)/);
    const urlMatch = card.match(/base-card__full-link[^>]*href="([^"?]+)/);
    const locationMatch = card.match(/job-search-card__location">([^<]+)/);
    const companyMatch = card.match(/base-search-card__subtitle[^>]*>[^<]*<a[^>]*>([^<]+)/);
    const postedMatch = card.match(/job-search-card__listdate[^>]*datetime="([^"]+)"/);

    if (titleMatch && urlMatch) {
      jobs.push({
        id: `linkedin-${Date.now()}-${index}`,
        source: 'linkedin',
        title: titleMatch[1].trim(),
        company: companyMatch ? companyMatch[1].trim() : 'Empresa no LinkedIn',
        description: '',
        url: urlMatch[1],
        location: locationMatch ? locationMatch[1].trim() : (country === 'pt' ? 'Portugal' : 'Brasil'),
        jobType: 'On-site',
        tags: [],
        postedAt: postedMatch ? new Date(postedMatch[1]) : undefined,
        country: country,
      });
    }
  });

  return jobs;
}

// ==========================================
// Smart Job Search with AI (Resume-based)
// ==========================================

export interface ResumeData {
  personalInfo: {
    name: string;
    email: string;
  };
  skills: Array<{
    name: string;
    level: number;
    category: string;
  }>;
  experience: Array<{
    title: string;
    company: string;
    responsibilities: string[];
  }>;
  certifications: Array<{
    name: string;
  }>;
}

export interface SmartSearchResult {
  jobs: JobListing[];
  keywords: string[];
  matchScore?: number;
}

export function extractKeywordsFromResume(resume: ResumeData): string[] {
  const keywords = new Set<string>();

  // Extract from skills (prioritize higher level skills)
  const sortedSkills = [...resume.skills].sort((a, b) => b.level - a.level);
  for (const skill of sortedSkills) {
    keywords.add(skill.name.toLowerCase());
  }

  // Extract technology keywords from job titles
  const titleKeywords = ['developer', 'engineer', 'programmer', 'full-stack', 'fullstack',
    'backend', 'frontend', 'mobile', 'devops', 'data', 'software'];
  for (const exp of resume.experience) {
    for (const kw of titleKeywords) {
      if (exp.title.toLowerCase().includes(kw)) {
        keywords.add(kw);
      }
    }
  }

  // Extract from certifications
  for (const cert of resume.certifications) {
    const certKeywords = cert.name.match(/\b(java|react|node|python|docker|kubernetes|aws|azure|php|laravel|flutter|dart|typescript|javascript|angular|vue|go|rust|c#|\.net|sql|mongodb|postgresql|redis)\b/gi);
    if (certKeywords) {
      certKeywords.forEach(kw => keywords.add(kw.toLowerCase()));
    }
  }

  return Array.from(keywords);
}

export function generateSearchQueries(keywords: string[]): string[] {
  const queries: string[] = [];

  // Top skills as individual queries
  const topKeywords = keywords.slice(0, 5);
  queries.push(...topKeywords);

  // Combinations
  if (topKeywords.length >= 2) {
    queries.push(`${topKeywords[0]} ${topKeywords[1]}`);
  }

  // Common developer search terms
  const roleQueries = ['full-stack developer', 'backend developer', 'frontend developer', 'software engineer'];
  queries.push(...roleQueries.slice(0, 2));

  return Array.from(new Set(queries));
}

export interface SmartSearchOptions {
  country?: string; // 'br' | 'pt' | 'remote' | 'all' or comma-separated like 'br,pt'
  source?: JobSource | JobSource[];
  limit?: number;
  maxAgeDays?: number;
}

export async function smartJobSearch(
  resume: ResumeData,
  options: SmartSearchOptions = {}
): Promise<SmartSearchResult> {
  const {
    country = 'all',
    source = 'all',
    limit = 50,
    maxAgeDays = 0,
  } = options;

  const keywords = extractKeywordsFromResume(resume);
  const queries = generateSearchQueries(keywords);

  // Convert source to array for easier handling
  const sources = Array.isArray(source) ? source : [source];
  const isAllSources = sources.includes('all');

  // Parse countries (comma-separated string or single value)
  const countries = country.includes(',')
    ? country.split(',').filter(Boolean)
    : [country];
  const isAllCountries = countries.includes('all');

  // Search with top keywords in parallel using the selected source(s)
  const searchPromises: Promise<JobListing[]>[] = [];

  // Use searchJobs which now handles multiple countries
  searchPromises.push(
    ...queries.slice(0, 3).map(query =>
      searchJobs({ keyword: query, country, limit: Math.ceil(limit / 3), maxAgeDays }, isAllSources ? 'all' : sources)
    )
  );

  const results = await Promise.all(searchPromises);
  let allJobs = results.flat();

  // Filter by age if specified
  if (maxAgeDays > 0) {
    allJobs = filterJobsByAge(allJobs, maxAgeDays);
  }

  // Deduplicate by external ID
  const seen = new Set<string>();
  const uniqueJobs = allJobs.filter(job => {
    if (seen.has(job.id)) return false;
    seen.add(job.id);
    return true;
  });

  // Sort by relevance (jobs matching more keywords first)
  const scoredJobs = uniqueJobs.map(job => {
    let score = 0;
    const jobText = `${job.title} ${job.description} ${job.tags?.join(' ') || ''}`.toLowerCase();

    for (const keyword of keywords) {
      if (jobText.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }

    return { job, score };
  });

  scoredJobs.sort((a, b) => b.score - a.score);

  return {
    jobs: scoredJobs.slice(0, limit).map(s => s.job),
    keywords,
  };
}
