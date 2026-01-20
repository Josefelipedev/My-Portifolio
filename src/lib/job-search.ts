// Job Search Library - Integration with RemoteOK and Remotive APIs

export interface JobListing {
  id: string;
  source: 'remoteok' | 'remotive';
  title: string;
  company: string;
  companyLogo?: string;
  description: string;
  url: string;
  location?: string;
  jobType?: string;
  salary?: string;
  tags?: string[];
  postedAt?: Date;
}

export interface JobSearchParams {
  keyword?: string;
  location?: string;
  category?: string;
  limit?: number;
}

// RemoteOK API types
interface RemoteOKJob {
  id: string;
  slug: string;
  company: string;
  company_logo?: string;
  position: string;
  description: string;
  url: string;
  location?: string;
  tags?: string[];
  salary_min?: number;
  salary_max?: number;
  date: string;
}

// Remotive API types
interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string;
  category: string;
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary: string;
  description: string;
  tags?: string[];
}

interface RemotiveResponse {
  'job-count': number;
  jobs: RemotiveJob[];
}

// Fetch jobs from RemoteOK
export async function searchRemoteOK(params: JobSearchParams): Promise<JobListing[]> {
  try {
    // RemoteOK API endpoint
    const url = 'https://remoteok.com/api';

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Portfolio Job Search',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`RemoteOK API error: ${response.status}`);
    }

    const data: RemoteOKJob[] = await response.json();

    // First item is the legal notice, skip it
    const jobs = data.slice(1);

    // Filter by keyword if provided
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

    // Apply limit
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
    }));
  } catch (error) {
    console.error('RemoteOK API error:', error);
    return [];
  }
}

// Fetch jobs from Remotive
export async function searchRemotive(params: JobSearchParams): Promise<JobListing[]> {
  try {
    // Build URL with search params
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
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
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
    }));
  } catch (error) {
    console.error('Remotive API error:', error);
    return [];
  }
}

// Search both APIs and merge results
export async function searchAllJobs(params: JobSearchParams): Promise<JobListing[]> {
  const [remoteOKJobs, remotiveJobs] = await Promise.all([
    searchRemoteOK(params),
    searchRemotive(params),
  ]);

  // Merge and sort by date (newest first)
  const allJobs = [...remoteOKJobs, ...remotiveJobs];
  allJobs.sort((a, b) => {
    const dateA = a.postedAt?.getTime() || 0;
    const dateB = b.postedAt?.getTime() || 0;
    return dateB - dateA;
  });

  // Apply limit to merged results
  if (params.limit) {
    return allJobs.slice(0, params.limit);
  }

  return allJobs;
}

// Helper to format salary range
function formatSalary(min?: number, max?: number): string | undefined {
  if (!min && !max) return undefined;
  if (min && max) {
    return `$${formatNumber(min)} - $${formatNumber(max)}`;
  }
  if (min) {
    return `$${formatNumber(min)}+`;
  }
  if (max) {
    return `Up to $${formatNumber(max)}`;
  }
  return undefined;
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${Math.round(num / 1000)}k`;
  }
  return String(num);
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
