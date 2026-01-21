// Adzuna API (Needs API key - Brazil & Portugal)

import type { JobListing, JobSearchParams, AdzunaResponse } from '../types';
import { formatSalary } from '../helpers';

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
