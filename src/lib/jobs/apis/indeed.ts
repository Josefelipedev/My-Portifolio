// Indeed — RSS Feed (Brasil e Portugal)

import type { JobListing, JobSearchParams } from '../types';
import { cleanHtmlText } from '../helpers';

export async function searchIndeed(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const keyword = encodeURIComponent(params.keyword || 'desenvolvedor');
    const isPT = params.country === 'pt';
    const baseUrl = isPT ? 'https://pt.indeed.com' : 'https://br.indeed.com';
    const locationParam = isPT
      ? encodeURIComponent('Portugal')
      : encodeURIComponent('Brasil');
    const url = `${baseUrl}/rss?q=${keyword}&l=${locationParam}&sort=date`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': isPT ? 'pt-PT,pt;q=0.9' : 'pt-BR,pt;q=0.9',
        'Referer': baseUrl,
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Indeed RSS error: ${response.status}`);
    }

    const xml = await response.text();
    const jobs = parseIndeedRSS(xml, params.country || 'br');

    return jobs.slice(0, params.limit || 50);
  } catch (error) {
    console.error('Indeed RSS error:', error);
    return [];
  }
}

function parseIndeedRSS(xml: string, country: string): JobListing[] {
  const jobs: JobListing[] = [];

  // Extract <item> blocks from RSS
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  let index = 0;

  while ((match = itemPattern.exec(xml)) !== null) {
    const block = match[1];

    const title = extractCDataOrText(block, 'title');
    const link = extractText(block, 'link') || extractCDataOrText(block, 'link');
    const pubDate = extractCDataOrText(block, 'pubDate');
    const description = extractCDataOrText(block, 'description');
    const source = extractCDataOrText(block, 'source');

    // Indeed title format is often "Job Title - Company Name"
    let jobTitle = cleanHtmlText(title || '');
    let company = cleanHtmlText(source || '');

    // Try to parse company from title if source is empty
    if (!company && jobTitle.includes(' - ')) {
      const parts = jobTitle.split(' - ');
      company = parts[parts.length - 1].trim();
      jobTitle = parts.slice(0, -1).join(' - ').trim();
    }

    if (jobTitle && link) {
      jobs.push({
        id: `indeed-${country}-${index}-${Date.now()}`,
        source: 'indeed' as const,
        title: jobTitle,
        company: company || 'Empresa',
        description: cleanHtmlText(description || ''),
        url: link.trim(),
        location: country === 'pt' ? 'Portugal' : 'Brasil',
        jobType: undefined,
        tags: [],
        postedAt: pubDate ? new Date(pubDate) : undefined,
        country,
      });
    }
    index++;
  }

  return jobs;
}

function extractText(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return match ? match[1].trim() : '';
}

function extractCDataOrText(xml: string, tag: string): string {
  // Try CDATA first
  const cdataMatch = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`));
  if (cdataMatch) return cdataMatch[1].trim();
  // Fallback to plain text
  return extractText(xml, tag);
}
