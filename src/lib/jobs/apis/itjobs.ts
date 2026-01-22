// ITJobs.pt Web Scraping (Portugal)

import type { JobListing, JobSearchParams } from '../types';
import { extractJobsWithAI } from '../ai-extraction';
import { cleanHtmlText } from '../helpers';

interface ITJobsJob {
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  salary?: string;
}

export async function searchITJobs(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const keyword = encodeURIComponent(params.keyword || 'developer');
    const url = `https://www.itjobs.pt/pesquisa/?q=${keyword}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`ITJobs fetch error: ${response.status}`);
    }

    const html = await response.text();

    // Try AI extraction first
    let jobs: ITJobsJob[] = [];
    const aiJobs = await extractJobsWithAI(html, 'ITJobs', 'https://www.itjobs.pt');

    if (aiJobs.length > 0) {
      // Use AI-extracted jobs
      jobs = aiJobs.map(job => ({
        title: job.title,
        company: job.company,
        location: job.location || 'Portugal',
        url: job.url,
        description: job.description || '',
        salary: undefined,
      }));
    } else {
      // Fallback to regex parsing
      console.log('ITJobs: AI extraction failed, using regex fallback');
      jobs = parseITJobsHTML(html);
    }

    return jobs.slice(0, params.limit || 50).map((job, index) => ({
      id: `itjobs-${Date.now()}-${index}`,
      source: 'itjobs' as const,
      title: job.title,
      company: job.company || 'Empresa não identificada',
      description: job.description || '',
      url: job.url.startsWith('http') ? job.url : `https://www.itjobs.pt${job.url}`,
      location: job.location || 'Portugal',
      jobType: 'On-site',
      salary: job.salary,
      tags: [],
      postedAt: new Date(),
      country: 'pt',
    }));
  } catch (error) {
    console.error('ITJobs scraping error:', error);
    return [];
  }
}

function parseITJobsHTML(html: string): ITJobsJob[] {
  const jobs: ITJobsJob[] = [];

  // Pattern for job listings: /oferta/ID/job-title-slug
  // ITJobs uses a structure with job cards containing title links, company, location, and optional salary
  const jobPattern = /<a[^>]*href=["']?(\/oferta\/\d+\/[^"'\s>]+)["']?[^>]*>([^<]+)<\/a>/gi;

  let match;
  const seenUrls = new Set<string>();

  while ((match = jobPattern.exec(html)) !== null) {
    const url = match[1];
    const title = cleanHtmlText(match[2]);

    // Skip if already seen or invalid title
    if (seenUrls.has(url) || !title || title.length < 3) {
      continue;
    }
    seenUrls.add(url);

    // Get context around the match to extract company and location
    const contextStart = Math.max(0, match.index - 500);
    const contextEnd = Math.min(html.length, match.index + 1500);
    const context = html.substring(contextStart, contextEnd);

    // Extract company name - usually in a link after the job title
    // Pattern: company name appears as link text or in alt attribute of company logo
    let company = '';

    // Try to find company from image alt or nearby link
    const companyLogoMatch = context.match(/alt=["']([^"']+)["'][^>]*class=["'][^"']*company/i) ||
                            context.match(/class=["'][^"']*company[^"']*["'][^>]*alt=["']([^"']+)["']/i);
    if (companyLogoMatch) {
      company = cleanHtmlText(companyLogoMatch[1]);
    }

    // If no company from logo, try finding it from a link near the job listing
    if (!company) {
      // Look for company link pattern - usually after the job title
      const companyLinkMatch = context.match(/href=["']\/empresa\/[^"']+["'][^>]*>([^<]+)<\/a>/i);
      if (companyLinkMatch) {
        company = cleanHtmlText(companyLinkMatch[1]);
      }
    }

    // Extract location - usually plain text like "Lisboa" or "Porto, Lisboa"
    let location = 'Portugal';
    const locationMatch = context.match(/<(?:span|div)[^>]*>([^<]*(?:Lisboa|Porto|Braga|Coimbra|Aveiro|Faro|Leiria|Setúbal|Viseu|Remote|Remoto)[^<]*)<\/(?:span|div)>/i);
    if (locationMatch) {
      location = cleanHtmlText(locationMatch[1]);
    }

    // Extract salary if present - pattern: €XX XXX or €XX.XXX
    let salary: string | undefined;
    const salaryMatch = context.match(/€\s?[\d\s.,]+/);
    if (salaryMatch) {
      salary = cleanHtmlText(salaryMatch[0]);
    }

    // Skip navigation links and non-job entries
    if (title.toLowerCase().includes('pesquisa') ||
        title.toLowerCase().includes('login') ||
        title.toLowerCase().includes('registar') ||
        url.includes('/local/') ||
        url.includes('/emprego/')) {
      continue;
    }

    jobs.push({
      title,
      company,
      location,
      url,
      description: '',
      salary,
    });
  }

  return jobs;
}
