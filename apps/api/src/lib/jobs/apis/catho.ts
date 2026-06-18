// Catho — Plataforma brasileira de empregos

import type { JobListing, JobSearchParams } from '../types';
import { cleanHtmlText } from '../helpers';

export async function searchCatho(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const keyword = encodeURIComponent(params.keyword || 'desenvolvedor');
    const url = `https://www.catho.com.br/vagas/${keyword}/`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Catho fetch error: ${response.status}`);
    }

    const html = await response.text();
    const jobs = parseCathoHTML(html);

    return jobs.slice(0, params.limit || 50);
  } catch (error) {
    console.error('Catho scraping error:', error);
    return [];
  }
}

function parseCathoHTML(html: string): JobListing[] {
  const jobs: JobListing[] = [];

  // Catho uses data-vagas-id or similar attributes in their job cards.
  // Pattern for job listing items: look for structured data (JSON-LD) first
  const jsonLdPattern = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdPattern.exec(html)) !== null) {
    try {
      const jsonData = JSON.parse(match[1]);
      const entries = Array.isArray(jsonData) ? jsonData : [jsonData];
      for (const entry of entries) {
        if (entry['@type'] === 'JobPosting') {
          const job = parseJobPosting(entry);
          if (job) jobs.push(job);
        }
      }
    } catch {
      // Invalid JSON — skip
    }
  }

  // If JSON-LD worked, return results
  if (jobs.length > 0) return jobs;

  // Fallback: HTML card pattern
  // Catho card: <article class="...sc-..."> or data attributes
  const cardPattern = /data-ds-component="Card"[^>]*>([\s\S]*?)(?=data-ds-component="Card"|<\/section>|<\/main>)/gi;
  let index = 0;

  while ((match = cardPattern.exec(html)) !== null) {
    const block = match[1];
    const title = extractTagText(block, 'h2') || extractTagText(block, 'h3');
    const company = extractAttrClass(block, 'company') || extractAttrClass(block, 'employer');
    const location = extractAttrClass(block, 'location') || extractAttrClass(block, 'city');
    const url = extractHref(block);

    if (title) {
      jobs.push({
        id: `catho-${index}`,
        source: 'catho' as const,
        title,
        company: company || 'Empresa',
        description: '',
        url: url
          ? url.startsWith('http')
            ? url
            : `https://www.catho.com.br${url}`
          : 'https://www.catho.com.br/vagas/',
        location: location || 'Brasil',
        tags: [],
        country: 'br',
      });
    }
    index++;
  }

  return jobs;
}

// Parse a JSON-LD JobPosting object into a JobListing
function parseJobPosting(entry: Record<string, unknown>): JobListing | null {
  const title = String(entry.title || entry.name || '').trim();
  const url = String(entry.url || entry['@id'] || '').trim();
  if (!title || !url) return null;

  const org = entry.hiringOrganization as Record<string, unknown> | undefined;
  const company = org ? String(org.name || '').trim() : '';

  const loc = entry.jobLocation as Record<string, unknown> | undefined;
  const address = loc?.address as Record<string, unknown> | undefined;
  const location = address
    ? [address.addressLocality, address.addressRegion].filter(Boolean).join(', ')
    : 'Brasil';

  const salary = parseSalary(entry.baseSalary as Record<string, unknown> | undefined);
  const postedAt = entry.datePosted ? new Date(String(entry.datePosted)) : undefined;
  const description = cleanHtmlText(String(entry.description || '')).substring(0, 500);

  const empType = String(entry.employmentType || '').toLowerCase();
  let jobType = 'On-site';
  if (empType.includes('remote') || empType.includes('remoto')) jobType = 'Remote';
  else if (empType.includes('hybrid') || empType.includes('híbrido')) jobType = 'Hybrid';

  return {
    id: `catho-jsonld-${Buffer.from(url).toString('base64').substring(0, 16)}`,
    source: 'catho' as const,
    title,
    company: company || 'Empresa',
    description,
    url,
    location,
    salary,
    jobType,
    tags: [],
    postedAt,
    country: 'br',
  };
}

function parseSalary(salary?: Record<string, unknown>): string | undefined {
  if (!salary) return undefined;
  const value = salary.value as Record<string, unknown> | undefined;
  if (!value) return undefined;
  const min = value.minValue;
  const max = value.maxValue;
  const single = value.value;
  if (min && max) return `R$ ${min} – R$ ${max}`;
  if (single) return `R$ ${single}`;
  return undefined;
}

function extractTagText(html: string, tag: string): string {
  const m = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'));
  return m ? cleanHtmlText(m[1]) : '';
}

function extractAttrClass(html: string, className: string): string {
  const m = html.match(new RegExp(`class="[^"]*${className}[^"]*"[^>]*>([^<]+)<`, 'i'));
  return m ? cleanHtmlText(m[1]) : '';
}

function extractHref(html: string): string {
  const m = html.match(/href="([^"]+)"/i);
  return m ? m[1] : '';
}
