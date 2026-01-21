// Remotive API (Free, no key)

import type { JobListing, JobSearchParams, RemotiveResponse } from '../types';

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
