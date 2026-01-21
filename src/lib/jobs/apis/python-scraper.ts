// Integration with Python scraper service

import type { JobListing, JobSearchParams, JobSourceType } from '../types';

const PYTHON_SCRAPER_URL = process.env.PYTHON_SCRAPER_URL || 'http://localhost:8000';

interface PythonJob {
  id: string;
  source: string;
  title: string;
  company: string;
  company_logo?: string;
  description: string;
  url: string;
  location?: string;
  job_type?: string;
  salary?: string;
  tags: string[];
  posted_at?: string;
  country?: string;
}

interface PythonSearchResponse {
  jobs: PythonJob[];
  total: number;
  source: string;
  timestamp: string;
  errors: string[];
}

/**
 * Search jobs using Python scraper service
 */
export async function searchPythonScraper(
  params: JobSearchParams,
  source?: 'geekhunter' | 'vagascombr'
): Promise<JobListing[]> {
  try {
    const url = new URL(`${PYTHON_SCRAPER_URL}/search`);
    url.searchParams.set('keyword', params.keyword || 'desenvolvedor');
    url.searchParams.set('country', params.country || 'br');
    url.searchParams.set('limit', String(params.limit || 50));
    if (source) {
      url.searchParams.set('source', source);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Python scraper error: ${response.status}`);
    }

    const data: PythonSearchResponse = await response.json();

    if (data.errors.length > 0) {
      console.warn('[PythonScraper] Warnings:', data.errors);
    }

    return data.jobs.map((job) => ({
      id: job.id,
      source: job.source as JobSourceType,
      title: job.title,
      company: job.company,
      companyLogo: job.company_logo,
      description: job.description,
      url: job.url,
      location: job.location,
      jobType: job.job_type,
      salary: job.salary,
      tags: job.tags,
      postedAt: job.posted_at ? new Date(job.posted_at) : undefined,
      country: job.country,
    }));
  } catch (error) {
    console.error('[PythonScraper] Error:', error);
    return [];
  }
}

/**
 * Search GeekHunter using Python scraper
 */
export async function searchGeekHunterPython(
  params: JobSearchParams
): Promise<JobListing[]> {
  return searchPythonScraper(params, 'geekhunter');
}

/**
 * Search Vagas.com.br using Python scraper
 */
export async function searchVagasComBrPython(
  params: JobSearchParams
): Promise<JobListing[]> {
  return searchPythonScraper(params, 'vagascombr');
}

/**
 * Check if Python scraper service is available
 */
export async function isPythonScraperAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${PYTHON_SCRAPER_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get available scrapers from Python service
 */
export async function getPythonScraperSources(): Promise<string[]> {
  try {
    const response = await fetch(`${PYTHON_SCRAPER_URL}/sources`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.sources || [];
  } catch {
    return [];
  }
}
