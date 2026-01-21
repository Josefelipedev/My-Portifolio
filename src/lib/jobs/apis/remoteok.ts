// RemoteOK API (Free, no key)

import type { JobListing, JobSearchParams, RemoteOKJob } from '../types';
import { formatSalary } from '../helpers';

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
