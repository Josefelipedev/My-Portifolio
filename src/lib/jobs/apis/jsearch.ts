// JSearch API (RapidAPI - Global aggregator)

import type { JobListing, JobSearchParams, JSearchResponse } from '../types';
import { formatNumber } from '../helpers';

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
