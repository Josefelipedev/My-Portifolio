// GeekHunter Web Scraping (Brazil - Tech Jobs)

import type { JobListing, JobSearchParams } from '../types';
import { extractJobsWithAI } from '../ai-extraction';
import { cleanHtmlText } from '../helpers';
import { searchGeekHunterPython, isPythonScraperAvailable } from './python-scraper';
import { logger } from '@/lib/logger';

interface GeekHunterJob {
  title: string;
  company: string;
  location: string;
  url: string;
  salary?: string;
  tags?: string[];
}

export async function searchGeekHunter(params: JobSearchParams): Promise<JobListing[]> {
  // GeekHunter is focused on Brazil
  if (params.country && params.country !== 'br' && params.country !== 'all') {
    return [];
  }

  try {
    const keyword = encodeURIComponent(params.keyword || 'developer');
    const url = `https://www.geekhunter.com.br/vagas?search=${keyword}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      logger.error('geekhunter', `HTTP error: ${response.status}`, {
        response: { status: response.status },
        request: { url },
      });
      return tryPythonScraperFallback(params);
    }

    const html = await response.text();

    // Try AI extraction first
    let jobs: GeekHunterJob[] = [];
    const aiJobs = await extractJobsWithAI(html, 'GeekHunter', 'https://www.geekhunter.com.br');

    if (aiJobs.length > 0) {
      // Use AI-extracted jobs
      jobs = aiJobs.map(job => ({
        title: job.title,
        company: job.company,
        location: job.location || 'Brasil',
        url: job.url,
        salary: undefined,
        tags: [],
      }));
    } else {
      // Fallback to regex parsing
      logger.warn('geekhunter', 'AI extraction failed, using regex fallback');
      jobs = parseGeekHunterHTML(html);
    }

    const results = jobs.slice(0, params.limit || 50).map((job, index) => ({
      id: `geekhunter-${Date.now()}-${index}`,
      source: 'geekhunter' as const,
      title: job.title,
      company: job.company || 'Empresa confidencial',
      description: '',
      url: job.url.startsWith('http') ? job.url : `https://www.geekhunter.com.br${job.url}`,
      location: job.location || 'Brasil',
      jobType: 'On-site',
      salary: job.salary,
      tags: job.tags || [],
      postedAt: undefined,
      country: 'br',
    }));

    // If no results from JS scraping, try Python scraper as fallback
    if (results.length === 0) {
      logger.warn('geekhunter', 'No results from JS scraping, trying Python scraper fallback', {
        keyword: params.keyword,
        country: params.country,
      });
      return tryPythonScraperFallback(params);
    }

    logger.info('geekhunter', `Found ${results.length} jobs`, { count: results.length });
    return results;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('geekhunter', `Scraping error: ${err.message}`, {
      error: err.message,
      stack: err.stack,
      keyword: params.keyword,
      country: params.country,
    });
    // Try Python scraper as fallback on error
    return tryPythonScraperFallback(params);
  }
}

async function tryPythonScraperFallback(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const available = await isPythonScraperAvailable();
    if (available) {
      logger.info('geekhunter', 'Using Python scraper fallback');
      const results = await searchGeekHunterPython(params);
      logger.info('python-scraper', `GeekHunter fallback found ${results.length} jobs`, {
        count: results.length,
      });
      return results;
    } else {
      logger.warn('geekhunter', 'Python scraper not available for fallback');
    }
  } catch (fallbackError) {
    const err = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
    logger.error('python-scraper', `GeekHunter fallback failed: ${err.message}`, {
      error: err.message,
      stack: err.stack,
    });
  }
  return [];
}

function parseGeekHunterHTML(html: string): GeekHunterJob[] {
  const jobs: GeekHunterJob[] = [];

  // GeekHunter uses various patterns for job cards
  // Pattern 1: Job cards with data attributes
  const jobCardPattern = /<div[^>]*class="[^"]*(?:job-card|position-card|vaga-card)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;

  // Pattern 2: Links to job details
  const linkPattern = /<a[^>]*href="(\/vagas\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  // Pattern 3: Job listing items
  const listItemPattern = /<li[^>]*class="[^"]*job[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;

  // Extract job links and titles
  let match;
  const seenUrls = new Set<string>();

  // Try to find job links
  while ((match = linkPattern.exec(html)) !== null) {
    const url = match[1];
    const content = match[2];

    if (seenUrls.has(url)) continue;

    // Skip if it's a navigation or filter link
    if (url.includes('?') && !url.includes('/vagas/')) continue;

    // Extract title from link content or surrounding context
    const titleMatch = content.match(/<(?:h\d|span|p)[^>]*>([^<]+)<\/(?:h\d|span|p)>/i) ||
                       content.match(/([A-Za-zÀ-ÿ\s]+(?:Developer|Engineer|Desenvolvedor|Analista|Designer|Manager)[A-Za-zÀ-ÿ\s]*)/i);

    if (titleMatch) {
      const title = cleanHtmlText(titleMatch[1]);

      if (title.length > 5 && title.length < 150) {
        // Look for company in surrounding context
        const contextStart = Math.max(0, match.index - 500);
        const contextEnd = Math.min(html.length, match.index + 500);
        const context = html.substring(contextStart, contextEnd);

        // Extract company name
        const companyMatch = context.match(/(?:company|empresa|empregador)[^>]*>([^<]+)/i) ||
                            context.match(/<span[^>]*class="[^"]*company[^"]*"[^>]*>([^<]+)/i) ||
                            context.match(/<p[^>]*class="[^"]*company[^"]*"[^>]*>([^<]+)/i);

        const company = companyMatch ? cleanHtmlText(companyMatch[1]) : '';

        // Extract location
        const locationMatch = context.match(/(?:location|local|cidade)[^>]*>([^<]+)/i) ||
                             context.match(/<span[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)/i);

        const location = locationMatch ? cleanHtmlText(locationMatch[1]) : 'Brasil';

        // Extract salary if available
        const salaryMatch = context.match(/R\$\s*[\d.,]+(?:\s*[-–]\s*R?\$?\s*[\d.,]+)?/i) ||
                           context.match(/(?:salário|salary)[^>]*>([^<]+)/i);

        const salary = salaryMatch ? cleanHtmlText(salaryMatch[0]) : undefined;

        jobs.push({
          title,
          company,
          location,
          url,
          salary,
          tags: [],
        });

        seenUrls.add(url);
      }
    }
  }

  // If no jobs found with links, try card patterns
  if (jobs.length === 0) {
    let cardMatch;
    while ((cardMatch = jobCardPattern.exec(html)) !== null) {
      const card = cardMatch[1];

      // Extract title
      const titleMatch = card.match(/<h\d[^>]*>([^<]+)<\/h\d>/i) ||
                        card.match(/<a[^>]*>([^<]+)<\/a>/i);

      // Extract URL
      const urlMatch = card.match(/href="([^"]+)"/i);

      // Extract company
      const companyMatch = card.match(/(?:company|empresa)[^>]*>([^<]+)/i);

      if (titleMatch && urlMatch) {
        const title = cleanHtmlText(titleMatch[1]);
        const url = urlMatch[1];

        if (!seenUrls.has(url) && title.length > 5) {
          jobs.push({
            title,
            company: companyMatch ? cleanHtmlText(companyMatch[1]) : '',
            location: 'Brasil',
            url,
            tags: [],
          });

          seenUrls.add(url);
        }
      }
    }
  }

  return jobs.slice(0, 25);
}
