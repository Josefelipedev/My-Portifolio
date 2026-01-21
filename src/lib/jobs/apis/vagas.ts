// Vagas.com.br Web Scraping (Brazil)

import type { JobListing, JobSearchParams } from '../types';
import { extractJobsWithAI } from '../ai-extraction';
import { cleanHtmlText } from '../helpers';
import { searchVagasComBrPython, isPythonScraperAvailable } from './python-scraper';
import { logger } from '@/lib/logger';

interface VagasComBrJob {
  title: string;
  company: string;
  location: string;
  url: string;
  level: string;
}

export async function searchVagasComBr(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const keyword = encodeURIComponent(params.keyword || 'desenvolvedor');
    const url = `https://www.vagas.com.br/vagas-de-${keyword.replace(/%20/g, '-')}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      logger.error('vagascombr', `HTTP error: ${response.status}`, {
        response: { status: response.status },
        request: { url },
      });
      return tryPythonScraperFallback(params);
    }

    const html = await response.text();

    // Try AI extraction first
    let jobs: VagasComBrJob[] = [];
    const aiJobs = await extractJobsWithAI(html, 'Vagas.com.br', 'https://www.vagas.com.br');

    if (aiJobs.length > 0) {
      // Use AI-extracted jobs
      jobs = aiJobs.map(job => ({
        title: job.title,
        company: job.company,
        location: job.location || 'Brasil',
        url: job.url,
        level: job.level || '',
      }));
    } else {
      // Fallback to regex parsing
      logger.warn('vagascombr', 'AI extraction failed, using regex fallback');
      jobs = parseVagasComBrHTML(html);
    }

    const results = jobs.slice(0, params.limit || 50).map((job, index) => ({
      id: `vagascombr-${Date.now()}-${index}`,
      source: 'vagascombr' as const,
      title: job.title,
      company: job.company || 'Empresa confidencial',
      description: job.level ? `Nivel: ${job.level}` : '',
      url: job.url.startsWith('http') ? job.url : `https://www.vagas.com.br${job.url}`,
      location: job.location || 'Brasil',
      jobType: 'On-site',
      tags: job.level ? [job.level] : [],
      postedAt: undefined,
      country: 'br',
    }));

    // If no results from JS scraping, try Python scraper as fallback
    if (results.length === 0) {
      logger.warn('vagascombr', 'No results from JS scraping, trying Python scraper fallback', {
        keyword: params.keyword,
        country: params.country,
      });
      return tryPythonScraperFallback(params);
    }

    logger.info('vagascombr', `Found ${results.length} jobs`, { count: results.length });
    return results;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('vagascombr', `Scraping error: ${err.message}`, {
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
      logger.info('vagascombr', 'Using Python scraper fallback');
      const results = await searchVagasComBrPython(params);
      logger.info('python-scraper', `Vagas.com.br fallback found ${results.length} jobs`, {
        count: results.length,
      });
      return results;
    } else {
      logger.warn('vagascombr', 'Python scraper not available for fallback');
    }
  } catch (fallbackError) {
    const err = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
    logger.error('python-scraper', `Vagas.com.br fallback failed: ${err.message}`, {
      error: err.message,
      stack: err.stack,
    });
  }
  return [];
}

function parseVagasComBrHTML(html: string): VagasComBrJob[] {
  const jobs: VagasComBrJob[] = [];

  // Pattern: <a class="link-detalhes-vaga" data-id-vaga="ID" title="TITULO" href="/vagas/vID/slug">
  const jobPattern = /<a[^>]*class="link-detalhes-vaga"[^>]*data-id-vaga="(\d+)"[^>]*title="([^"]+)"[^>]*href="([^"]+)"/gi;

  let match;
  while ((match = jobPattern.exec(html)) !== null) {
    const vagaId = match[1];
    const title = cleanHtmlText(match[2]);
    const url = match[3];

    if (title && title.length > 3) {
      // Find company and level in surrounding context
      const contextStart = Math.max(0, match.index);
      const contextEnd = Math.min(html.length, match.index + 1000);
      const context = html.substring(contextStart, contextEnd);

      // Extract company from <span class="emprVaga">COMPANY</span>
      const companyMatch = context.match(/<span[^>]*class="emprVaga"[^>]*>\s*([^<]+)/i);
      const company = companyMatch ? cleanHtmlText(companyMatch[1]) : '';

      // Extract level from <span class="nivelVaga">LEVEL</span>
      const levelMatch = context.match(/<span[^>]*class="nivelVaga"[^>]*>\s*([^<]+)/i);
      const level = levelMatch ? cleanHtmlText(levelMatch[1]) : '';

      // Extract location from <div class="vaga-local"> (may contain icon before text)
      const locationMatch = context.match(/<div[^>]*class="vaga-local"[^>]*>[\s\S]*?<\/i>\s*([^<]+)/i) ||
                           context.match(/<div[^>]*class="vaga-local"[^>]*>\s*([^<]+)/i);
      const location = locationMatch ? cleanHtmlText(locationMatch[1]) : 'Brasil';

      jobs.push({
        title,
        company,
        location,
        url,
        level,
      });
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return jobs.filter(job => {
    if (seen.has(job.url)) return false;
    seen.add(job.url);
    return true;
  });
}
