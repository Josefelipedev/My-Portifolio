// Jooble API (Needs API key - Global)

import type { JobListing, JobSearchParams, JoobleResponse } from '../types';
import { getJobApiKeys } from '../api-keys';

const COUNTRY_LOCATIONS: Record<string, string> = { pt: 'Portugal', br: 'Brazil' };

export async function searchJooble(params: JobSearchParams): Promise<JobListing[]> {
  const keys = await getJobApiKeys();
  const apiKey = keys.joobleApiKey;

  if (!apiKey) {
    console.log('Jooble API: Missing credential (JOOBLE_API_KEY)');
    return [];
  }

  try {
    // The key is for the global endpoint, which defaults to US postings when no
    // location is sent; the country has to travel as the location.
    const url = `https://jooble.org/api/${apiKey}`;
    const location = params.location || COUNTRY_LOCATIONS[params.country || ''] || '';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keywords: params.keyword || '',
        location,
        page: 1,
      }),
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Jooble API error: ${response.status}`);
    }

    const data = (await response.json()) as JoobleResponse;
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
    throw error;
  }
}
