// Arbeitnow API (Free, no key - European tech jobs)

import type { JobListing, JobSearchParams, ArbeitnowResponse } from '../types';

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
