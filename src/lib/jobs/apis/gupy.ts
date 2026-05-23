// Gupy API (Brazil) — Portal público de vagas

import type { JobListing, JobSearchParams } from '../types';

interface GupyJob {
  id: number;
  name: string;
  careerPageName: string;
  careerPageLogo?: string;
  description?: string;
  publishedDate?: string;
  jobUrl: string;
  city?: string;
  state?: string;
  workplaceType?: string; // 'remote' | 'hybrid' | 'presential'
  disabilities?: boolean;
}

interface GupyResponse {
  data: GupyJob[];
  pagination: {
    total: number;
    offset: number;
    limit: number;
  };
}

export async function searchGupy(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const keyword = encodeURIComponent(params.keyword || 'desenvolvedor');
    const limit = Math.min(params.limit || 50, 100);
    const url = `https://portal.api.gupy.io/api/v1/jobs?jobName=${keyword}&limit=${limit}&offset=0`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Referer': 'https://portal.gupy.io/',
        'Origin': 'https://portal.gupy.io',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Gupy API error: ${response.status}`);
    }

    const data: GupyResponse = await response.json();
    const jobs = data?.data || [];

    return jobs.map((job, index) => {
      const locationParts = [job.city, job.state].filter(Boolean);
      const location = locationParts.length > 0 ? locationParts.join(', ') : 'Brasil';

      let jobType = 'On-site';
      if (job.workplaceType === 'remote') jobType = 'Remote';
      else if (job.workplaceType === 'hybrid') jobType = 'Hybrid';

      return {
        id: `gupy-${job.id || index}`,
        source: 'gupy' as const,
        title: job.name || 'Vaga',
        company: job.careerPageName || 'Empresa',
        companyLogo: job.careerPageLogo || undefined,
        description: job.description || '',
        url: job.jobUrl || 'https://portal.gupy.io/',
        location,
        jobType,
        tags: [],
        postedAt: job.publishedDate ? new Date(job.publishedDate) : undefined,
        country: 'br',
      };
    });
  } catch (error) {
    console.error('Gupy API error:', error);
    return [];
  }
}
