// Programathor — Plataforma de vagas tech do Brasil

import type { JobListing, JobSearchParams } from '../types';
import { cleanHtmlText } from '../helpers';

export async function searchProgramathor(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const keyword = encodeURIComponent(params.keyword || '');
    const url = keyword
      ? `https://programathor.com.br/jobs-tech?search=${keyword}&page=1`
      : `https://programathor.com.br/jobs-tech?page=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Programathor fetch error: ${response.status}`);
    }

    const html = await response.text();
    const jobs = parseProgramathorHTML(html);

    return jobs.slice(0, params.limit || 50);
  } catch (error) {
    console.error('Programathor scraping error:', error);
    return [];
  }
}

function parseProgramathorHTML(html: string): JobListing[] {
  const jobs: JobListing[] = [];

  // Programathor job cards: <div class="cell-list-developer"> or <li data-id="...">
  // Their cards usually contain: title, company, location, tags, link

  // Pattern 1: article/list item blocks containing job info
  const cardPattern = /<(?:li|article)[^>]*data-id="([^"]*)"[^>]*>([\s\S]*?)(?=<(?:li|article)[^>]*data-id|$)/gi;
  let match;
  let index = 0;

  while ((match = cardPattern.exec(html)) !== null) {
    const jobId = match[1];
    const block = match[2];

    const title = extractTitle(block);
    const company = extractCompany(block);
    const location = extractLocation(block);
    const url = extractUrl(block);
    const tags = extractTags(block);
    const postedAt = extractDate(block);

    if (title) {
      jobs.push({
        id: `programathor-${jobId || index}`,
        source: 'programathor' as const,
        title,
        company: company || 'Empresa',
        description: '',
        url: url ? (url.startsWith('http') ? url : `https://programathor.com.br${url}`) : 'https://programathor.com.br/jobs-tech',
        location: location || 'Brasil',
        jobType: undefined,
        tags,
        postedAt,
        country: 'br',
      });
    }
    index++;
  }

  // Fallback: simpler pattern looking for h2/h3 headings with links
  if (jobs.length === 0) {
    const linkPattern = /<a[^>]+href="(\/jobs-tech\/[^"]+)"[^>]*>\s*<(?:h2|h3|h4)[^>]*>([^<]+)<\/(?:h2|h3|h4)>/gi;
    let i = 0;
    while ((linkPattern.exec(html)) !== null && i < 50) {
      const href = linkPattern.source.match(/href="([^"]+)"/)?.[1] || '';
      const title = linkPattern.source.match(/>([^<]+)<\//)?.[1] || '';
      if (title && href) {
        jobs.push({
          id: `programathor-fallback-${i}`,
          source: 'programathor' as const,
          title: cleanHtmlText(title),
          company: 'Empresa',
          description: '',
          url: `https://programathor.com.br${href}`,
          location: 'Brasil',
          jobType: undefined,
          tags: [],
          country: 'br',
        });
      }
      i++;
    }
  }

  return jobs;
}

function extractTitle(block: string): string {
  // Look for h2/h3/h4 tags
  const m = block.match(/<(?:h2|h3|h4)[^>]*>([^<]+)<\/(?:h2|h3|h4)>/i);
  if (m) return cleanHtmlText(m[1]);
  // Look for class="title" or class="job-title"
  const m2 = block.match(/class="[^"]*(?:title|job-name)[^"]*"[^>]*>([^<]+)</i);
  if (m2) return cleanHtmlText(m2[1]);
  return '';
}

function extractCompany(block: string): string {
  const m = block.match(/class="[^"]*(?:company|employer)[^"]*"[^>]*>([^<]+)</i);
  if (m) return cleanHtmlText(m[1]);
  return '';
}

function extractLocation(block: string): string {
  const m = block.match(/class="[^"]*(?:location|city)[^"]*"[^>]*>([^<]+)</i);
  if (m) return cleanHtmlText(m[1]);
  return '';
}

function extractUrl(block: string): string {
  const m = block.match(/href="(\/jobs-tech\/[^"?]+)"/i);
  return m ? m[1] : '';
}

function extractTags(block: string): string[] {
  const tags: string[] = [];
  const tagPattern = /class="[^"]*(?:tag|badge|skill)[^"]*"[^>]*>([^<]+)</gi;
  let m;
  while ((m = tagPattern.exec(block)) !== null) {
    const tag = cleanHtmlText(m[1]);
    if (tag && tag.length < 30) tags.push(tag);
  }
  return Array.from(new Set(tags)).slice(0, 10);
}

function extractDate(block: string): Date | undefined {
  const m = block.match(/datetime="([^"]+)"/i);
  if (m) {
    try { return new Date(m[1]); } catch { /* ignore */ }
  }
  return undefined;
}
