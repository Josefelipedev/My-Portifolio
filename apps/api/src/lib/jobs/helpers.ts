// Job Search Helper Functions

import type { JobListing } from './types';

/**
 * Format salary range into human-readable string
 */
export function formatSalary(min?: number, max?: number): string | undefined {
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

/**
 * Format number to human-readable string (e.g., 50000 -> "50k")
 */
export function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${Math.round(num / 1000)}k`;
  }
  return String(num);
}

/**
 * Clean HTML text by removing tags and decoding entities
 */
export function cleanHtmlText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Filter jobs by age (days since posting)
 */
export function filterJobsByAge(jobs: JobListing[], maxAgeDays: number): JobListing[] {
  if (!maxAgeDays || maxAgeDays <= 0) return jobs;

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);

  return jobs.filter(job => {
    if (!job.postedAt) return true; // Keep jobs without date (we don't know how old they are)
    const jobDate = new Date(job.postedAt);
    return jobDate >= cutoffDate;
  });
}

/**
 * Parse Portuguese/Brazilian date formats (DD-MM-YYYY or DD/MM/YYYY)
 */
export function parsePortugueseDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;

  const match = dateStr.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }

  return undefined;
}

/**
 * Extract salary from description text
 */
export function extractSalaryFromText(text: string): string | undefined {
  // Common patterns for salary
  const patterns = [
    // USD patterns
    /\$\s*(\d{1,3}(?:,?\d{3})*)\s*(?:-|to|–)\s*\$?\s*(\d{1,3}(?:,?\d{3})*)/i,
    /(\d{1,3}(?:,?\d{3})*)\s*(?:-|to|–)\s*(\d{1,3}(?:,?\d{3})*)\s*(?:usd|dollars?)/i,
    // BRL patterns
    /R\$\s*(\d{1,3}(?:[.,]?\d{3})*)\s*(?:-|a|–)\s*R?\$?\s*(\d{1,3}(?:[.,]?\d{3})*)/i,
    // EUR patterns
    /€\s*(\d{1,3}(?:[.,]?\d{3})*)\s*(?:-|to|–)\s*€?\s*(\d{1,3}(?:[.,]?\d{3})*)/i,
    // Generic k patterns
    /(\d+)\s*k\s*(?:-|to|–)\s*(\d+)\s*k/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return undefined;
}

/**
 * Detect experience level from job title or description
 */
export function detectExperienceLevel(title: string, description: string): 'junior' | 'mid' | 'senior' | undefined {
  const text = `${title} ${description}`.toLowerCase();

  // Senior patterns
  if (/\b(senior|sr\.?|lead|principal|staff|architect|head of)\b/i.test(text)) {
    return 'senior';
  }

  // Junior patterns
  if (/\b(junior|jr\.?|entry[\s-]?level|trainee|intern|estagio|estagiario|estágio|estagiário)\b/i.test(text)) {
    return 'junior';
  }

  // Mid-level patterns
  if (/\b(mid[\s-]?level|pleno|intermediate|regular)\b/i.test(text)) {
    return 'mid';
  }

  return undefined;
}

/**
 * Detect job type from job data
 */
export function detectJobType(job: Partial<JobListing>): 'remote' | 'hybrid' | 'onsite' | undefined {
  const text = `${job.title || ''} ${job.location || ''} ${job.jobType || ''} ${job.description || ''}`.toLowerCase();

  if (/\b(remote|remoto|trabalho remoto|home[\s-]?office|anywhere)\b/i.test(text)) {
    return 'remote';
  }

  if (/\b(hybrid|hibrido|híbrido)\b/i.test(text)) {
    return 'hybrid';
  }

  if (/\b(on[\s-]?site|presencial|in[\s-]?office|in[\s-]?person)\b/i.test(text)) {
    return 'onsite';
  }

  return undefined;
}

/**
 * Sort jobs by different criteria
 */
export function sortJobs(
  jobs: JobListing[],
  sortBy: 'date' | 'salary' | 'relevance' = 'date'
): JobListing[] {
  const sorted = [...jobs];

  switch (sortBy) {
    case 'date':
      sorted.sort((a, b) => {
        const dateA = a.postedAt?.getTime() || 0;
        const dateB = b.postedAt?.getTime() || 0;
        return dateB - dateA; // Newest first
      });
      break;

    case 'salary':
      sorted.sort((a, b) => {
        const salaryA = extractSalaryValue(a.salary);
        const salaryB = extractSalaryValue(b.salary);
        return salaryB - salaryA; // Highest first
      });
      break;

    case 'relevance':
      sorted.sort((a, b) => {
        const scoreA = a.relevanceScore || 0;
        const scoreB = b.relevanceScore || 0;
        return scoreB - scoreA; // Highest score first
      });
      break;
  }

  return sorted;
}

/**
 * Extract numeric salary value from salary string for sorting
 */
function extractSalaryValue(salary?: string): number {
  if (!salary) return 0;

  // Extract all numbers from the salary string
  const numbers = salary.match(/\d+(?:,\d{3})*(?:\.\d+)?/g);
  if (!numbers || numbers.length === 0) return 0;

  // Parse the first number (or max of two for ranges)
  const values = numbers.map(n => parseFloat(n.replace(/,/g, '')));

  // Check for 'k' multiplier
  if (/\d+\s*k/i.test(salary)) {
    return values[0] * 1000;
  }

  return Math.max(...values);
}

/**
 * Generate a unique hash for a job (used for deduplication)
 */
export function generateJobHash(job: JobListing): string {
  const title = job.title.toLowerCase().replace(/[^a-z0-9]/g, '');
  const company = job.company.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${title}-${company}`;
}

/**
 * Calculate days since a date
 */
export function daysSince(date: Date | undefined): number {
  if (!date) return Infinity;
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
