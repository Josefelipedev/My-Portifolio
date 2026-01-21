// Job Search Types

export interface JobListing {
  id: string;
  source: JobSourceType;
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
  country?: string;
  relevanceScore?: number; // Added for scoring system
}

export type JobSourceType =
  | 'remoteok'
  | 'remotive'
  | 'arbeitnow'
  | 'adzuna'
  | 'jooble'
  | 'jsearch'
  | 'netempregos'
  | 'vagascombr'
  | 'linkedin';

export type JobSource = 'all' | JobSourceType;

export interface JobSearchParams {
  keyword?: string;
  location?: string;
  country?: string; // 'br' | 'pt' | 'us' | 'remote' | etc
  category?: string;
  limit?: number;
  maxAgeDays?: number; // Filter jobs older than X days (0 = no filter)
  page?: number; // For pagination
  pageSize?: number; // For pagination
}

export interface JobSearchResult {
  jobs: JobListing[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiStatus {
  name: string;
  configured: boolean;
  needsKey: boolean;
}

// Resume types for smart search
export interface ResumeData {
  personalInfo: {
    name: string;
    email: string;
  };
  skills: Array<{
    name: string;
    level: number;
    category: string;
  }>;
  experience: Array<{
    title: string;
    company: string;
    responsibilities: string[];
  }>;
  certifications: Array<{
    name: string;
  }>;
}

export interface SmartSearchResult {
  jobs: JobListing[];
  keywords: string[];
  matchScore?: number;
}

export interface SmartSearchOptions {
  country?: string;
  source?: JobSource | JobSource[];
  limit?: number;
  maxAgeDays?: number;
}

// AI Extraction types
export interface AIExtractedJob {
  title: string;
  company: string;
  location: string;
  url: string;
  level?: string;
  description?: string;
}

// API-specific types
export interface RemoteOKJob {
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

export interface RemotiveJob {
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

export interface RemotiveResponse {
  'job-count': number;
  jobs: RemotiveJob[];
}

export interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string;
  created_at: number;
}

export interface ArbeitnowResponse {
  data: ArbeitnowJob[];
  links: { next?: string };
  meta: { total: number };
}

export interface AdzunaJob {
  id: string;
  title: string;
  description: string;
  redirect_url: string;
  company: { display_name: string };
  location: { display_name: string; area: string[] };
  salary_min?: number;
  salary_max?: number;
  created: string;
  category: { label: string; tag: string };
}

export interface AdzunaResponse {
  results: AdzunaJob[];
  count: number;
}

export interface JoobleJob {
  title: string;
  location: string;
  snippet: string;
  salary: string;
  source: string;
  type: string;
  link: string;
  company: string;
  updated: string;
  id: string;
}

export interface JoobleResponse {
  totalCount: number;
  jobs: JoobleJob[];
}

export interface JSearchJob {
  job_id: string;
  job_title: string;
  employer_name: string;
  employer_logo?: string;
  job_description: string;
  job_apply_link: string;
  job_city: string;
  job_state: string;
  job_country: string;
  job_employment_type: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
  job_posted_at_datetime_utc: string;
  job_required_skills?: string[];
}

export interface JSearchResponse {
  status: string;
  data: JSearchJob[];
}

// Filters for advanced filtering
export interface JobFilters {
  salaryMin?: number;
  salaryMax?: number;
  jobType?: 'all' | 'remote' | 'hybrid' | 'onsite';
  experienceLevel?: 'all' | 'junior' | 'mid' | 'senior';
  sortBy?: 'date' | 'salary' | 'relevance';
}
