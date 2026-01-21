// Net-Empregos Web Scraping (Portugal)

import type { JobListing, JobSearchParams } from '../types';
import { extractJobsWithAI } from '../ai-extraction';
import { cleanHtmlText, parsePortugueseDate } from '../helpers';

interface NetEmpregosJob {
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  date: string;
}

export async function searchNetEmpregos(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const keyword = encodeURIComponent(params.keyword || 'developer');
    const url = `https://www.net-empregos.com/pesquisa-empregos.asp?chaves=${keyword}&categoria=0`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Net-Empregos fetch error: ${response.status}`);
    }

    const html = await response.text();

    // Try AI extraction first
    let jobs: NetEmpregosJob[] = [];
    const aiJobs = await extractJobsWithAI(html, 'Net-Empregos', 'https://www.net-empregos.com');

    if (aiJobs.length > 0) {
      // Use AI-extracted jobs
      jobs = aiJobs.map(job => ({
        title: job.title,
        company: job.company,
        location: job.location || 'Portugal',
        url: job.url,
        description: job.description || '',
        date: '',
      }));
    } else {
      // Fallback to regex parsing
      console.log('Net-Empregos: AI extraction failed, using regex fallback');
      jobs = parseNetEmpregosHTML(html);
    }

    return jobs.slice(0, params.limit || 50).map((job, index) => ({
      id: `netempregos-${Date.now()}-${index}`,
      source: 'netempregos' as const,
      title: job.title,
      company: job.company || 'Empresa não identificada',
      description: job.description || '',
      url: job.url.startsWith('http') ? job.url : `https://www.net-empregos.com${job.url}`,
      location: job.location || 'Portugal',
      jobType: 'On-site',
      tags: [],
      postedAt: parsePortugueseDate(job.date),
      country: 'pt',
    }));
  } catch (error) {
    console.error('Net-Empregos scraping error:', error);
    return [];
  }
}

function parseNetEmpregosHTML(html: string): NetEmpregosJob[] {
  const jobs: NetEmpregosJob[] = [];

  // New pattern: <h2><a class="oferta-link" href="/ID/TITLE/">TITLE</a></h2>
  // Pattern for job items with h2 titles
  const jobPattern = /<h2[^>]*>[\s\S]*?<a[^>]*class="oferta-link"[^>]*href=["']?([^"'\s>]+)["']?[^>]*>([^<]+)<\/a>/gi;

  let match;
  while ((match = jobPattern.exec(html)) !== null) {
    const url = match[1].replace(/^=/, ''); // Remove leading = if present
    const title = cleanHtmlText(match[2]);

    if (title && title.length > 3) {
      // Find the job-item container around this match to extract company and location
      const contextStart = Math.max(0, match.index - 100);
      const contextEnd = Math.min(html.length, match.index + 800);
      const context = html.substring(contextStart, contextEnd);

      // Extract company from <li><i class="flaticon-work"></i> COMPANY</li>
      const companyMatch = context.match(/flaticon-work[^>]*><\/i>\s*([^<]+)</i);
      const company = companyMatch ? cleanHtmlText(companyMatch[1]) : '';

      // Extract location from <i class="flaticon-location"></i> LOCATION
      const localMatch = context.match(/flaticon-location[^>]*><\/i>\s*([^<]+)</i);
      const location = localMatch ? cleanHtmlText(localMatch[1]) : 'Portugal';

      // Extract date - look for patterns like "há X dias" or date format
      const dateMatch = context.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
      const date = dateMatch ? dateMatch[1] : '';

      jobs.push({
        title,
        company,
        location,
        url: url.startsWith('/') ? url : `/${url}`,
        description: '',
        date,
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
