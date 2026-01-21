// Jooble API (Needs API key - Global)

import type { JobListing, JobSearchParams, JoobleResponse } from '../types';

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
