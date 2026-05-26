// Jobicy API — free remote jobs, no key needed
// Docs: https://jobicy.com/jobs-rss-feed

import type { JobListing, JobSearchParams } from '../types';

interface JobicyJob {
  id: number;
  url: string;
  jobTitle: string;
  companyName: string;
  companyLogo?: string;
  jobIndustry: string[];
  jobType: string[];
  jobGeo: string;
  jobLevel: string;
  jobExcerpt: string;
  jobDescription: string;
  pubDate: string;
  annualSalaryMin?: number;
  annualSalaryMax?: number;
  salaryCurrency?: string;
}

interface JobicyResponse {
  status: string;
  requestId: string;
  feedTitle: string;
  jobs: JobicyJob[];
}

export async function searchJobicy(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const url = new URL('https://jobicy.com/api/v2/remote-jobs');
    url.searchParams.set('count', String(Math.min(params.limit || 50, 50)));

    if (params.keyword) {
      url.searchParams.set('search', params.keyword);
    }

    // Map category if available
    if (params.category) {
      url.searchParams.set('industry', params.category);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'JobSearchPortfolio/1.0',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Jobicy API error: ${response.status}`);
    }

    const data: JobicyResponse = await response.json();

    if (!Array.isArray(data.jobs)) return [];

    return data.jobs.map((job) => {
      let salary: string | undefined;
      if (job.annualSalaryMin && job.annualSalaryMax) {
        const currency = job.salaryCurrency || 'USD';
        salary = `${currency} ${job.annualSalaryMin.toLocaleString()}–${job.annualSalaryMax.toLocaleString()}/yr`;
      } else if (job.annualSalaryMin) {
        const currency = job.salaryCurrency || 'USD';
        salary = `${currency} ${job.annualSalaryMin.toLocaleString()}+/yr`;
      }

      return {
        id: `jobicy-${job.id}`,
        source: 'jobicy' as const,
        title: job.jobTitle,
        company: job.companyName,
        companyLogo: job.companyLogo,
        description: job.jobExcerpt || job.jobDescription?.slice(0, 300) || '',
        url: job.url,
        location: job.jobGeo || 'Remote',
        jobType: job.jobType?.join(', ') || 'Remote',
        salary,
        tags: job.jobIndustry || [],
        postedAt: job.pubDate ? new Date(job.pubDate) : undefined,
        country: 'remote',
      };
    });
  } catch (err) {
    console.error('Jobicy API error:', err);
    return [];
  }
}
