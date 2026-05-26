// BuscoJobs.pt — Portuguese job board scraper
// URL: https://www.buscojobs.pt/pesquisa/?q=keyword

import type { JobListing, JobSearchParams } from '../types';
import { cleanHtmlText } from '../helpers';

export async function searchBuscoJobs(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const keyword = encodeURIComponent(params.keyword || 'developer');
    const url = `https://www.buscojobs.pt/pesquisa/?q=${keyword}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
        'Referer': 'https://www.buscojobs.pt/',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`BuscoJobs fetch error: ${response.status}`);
    }

    const html = await response.text();
    const jobs = parseBuscoJobsHTML(html, params);

    return jobs.slice(0, params.limit || 50).map((job, index) => ({
      id: `buscojobs-${Date.now()}-${index}`,
      source: 'buscojobs' as const,
      title: job.title,
      company: job.company || 'Empresa não identificada',
      description: job.description || '',
      url: job.url.startsWith('http') ? job.url : `https://www.buscojobs.pt${job.url}`,
      location: job.location || 'Portugal',
      jobType: job.jobType || 'On-site',
      salary: job.salary,
      tags: [],
      postedAt: job.postedAt ? new Date(job.postedAt) : undefined,
      country: 'pt',
    }));
  } catch (err) {
    console.error('BuscoJobs scraping error:', err);
    return [];
  }
}

interface ParsedJob {
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  salary?: string;
  jobType?: string;
  postedAt?: string;
}

function parseBuscoJobsHTML(html: string, params: JobSearchParams): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  const keyword = (params.keyword || '').toLowerCase();
  const seenUrls = new Set<string>();

  // BuscoJobs job card URLs follow /oferta/SLUG or /empleo/ID patterns
  // Try multiple URL patterns to maximise coverage
  const urlPatterns = [
    /href=["']?(\/oferta\/[^"'\s>?#]+)["']?/gi,
    /href=["']?(\/emprego\/[^"'\s>?#]+)["']?/gi,
    /href=["']?(https?:\/\/www\.buscojobs\.pt\/oferta\/[^"'\s>?#]+)["']?/gi,
  ];

  for (const pattern of urlPatterns) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;

    while ((match = pattern.exec(html)) !== null) {
      const rawUrl = match[1];
      // Normalise to absolute URL
      const jobUrl = rawUrl.startsWith('http') ? rawUrl : `https://www.buscojobs.pt${rawUrl}`;

      if (seenUrls.has(jobUrl)) continue;

      // Grab surrounding context to extract job details
      const ctxStart = Math.max(0, match.index - 800);
      const ctxEnd = Math.min(html.length, match.index + 2000);
      const ctx = html.substring(ctxStart, ctxEnd);

      // Extract title — look for the link text itself or nearby heading
      let title = '';
      const linkTextMatch = ctx.match(new RegExp(
        rawUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '[^>]*>([^<]{3,120})<'
      ));
      if (linkTextMatch) {
        title = cleanHtmlText(linkTextMatch[1]);
      }

      // Fallback: look for heading-like text in context
      if (!title) {
        const headingMatch = ctx.match(/<h[123][^>]*>([^<]{3,120})<\/h[123]>/i);
        if (headingMatch) title = cleanHtmlText(headingMatch[1]);
      }

      if (!title || title.length < 3) continue;

      // Skip navigation/meta links
      const skip = ['pesquisa', 'login', 'registar', 'publicar', 'blog', 'home', 'contact'];
      if (skip.some(s => title.toLowerCase().includes(s))) continue;

      // Filter by keyword client-side when provided
      if (keyword && !title.toLowerCase().includes(keyword) && !ctx.toLowerCase().includes(keyword)) continue;

      seenUrls.add(jobUrl);

      // Company — look for company link patterns
      let company = '';
      const companyMatch =
        ctx.match(/href=["'][^"']*\/empresa\/[^"']+["'][^>]*>([^<]{2,80})<\/a>/i) ||
        ctx.match(/class=["'][^"']*company[^"']*["'][^>]*>([^<]{2,80})<\//i);
      if (companyMatch) company = cleanHtmlText(companyMatch[1]);

      // Location
      let location = 'Portugal';
      const locationMatch = ctx.match(
        /<[^>]*>([^<]*(Lisboa|Porto|Braga|Coimbra|Faro|Aveiro|Setúbal|Leiria|Évora|Viseu|Remoto|Remote)[^<]*)<\/[^>]*>/i
      );
      if (locationMatch) location = cleanHtmlText(locationMatch[1]);

      // Salary
      let salary: string | undefined;
      const salaryMatch = ctx.match(/€\s?[\d\s.,]+(?:\s*[-–]\s*€?\s*[\d\s.,]+)?/);
      if (salaryMatch) salary = cleanHtmlText(salaryMatch[0]);

      // Job type hint
      let jobType: string | undefined;
      if (/remoto|remote/i.test(ctx)) jobType = 'Remote';
      else if (/híbrido|hybrid/i.test(ctx)) jobType = 'Hybrid';
      else jobType = 'On-site';

      // Short description from meta description or snippet
      let description = '';
      const descMatch = ctx.match(/<p[^>]*class=["'][^"']*desc[^"']*["'][^>]*>([^<]{10,})<\/p>/i);
      if (descMatch) description = cleanHtmlText(descMatch[1]);

      jobs.push({ title, company, location, url: jobUrl, description, salary, jobType });
    }
  }

  return jobs;
}
