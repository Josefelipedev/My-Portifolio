// WeWorkRemotely — free RSS feed, no key needed
// Docs: https://weworkremotely.com/remote-jobs-rss

import type { JobListing, JobSearchParams } from '../types';

export async function searchWeWorkRemotely(params: JobSearchParams): Promise<JobListing[]> {
  try {
    // WWR provides category-based RSS feeds; for generic search use the "all jobs" feed
    const rssUrl = 'https://weworkremotely.com/remote-jobs.rss';

    const response = await fetch(rssUrl, {
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'JobSearchPortfolio/1.0',
      },
      next: { revalidate: 600 },
    });

    if (!response.ok) {
      throw new Error(`WeWorkRemotely RSS error: ${response.status}`);
    }

    const xml = await response.text();
    const jobs = parseWWRRSS(xml, params);

    return jobs.slice(0, params.limit || 50);
  } catch (err) {
    console.error('WeWorkRemotely RSS error:', err);
    return [];
  }
}

function parseWWRRSS(xml: string, params: JobSearchParams): JobListing[] {
  const jobs: JobListing[] = [];
  const items = xml.split('<item>').slice(1);
  const keyword = params.keyword?.toLowerCase() || '';

  items.forEach((item, index) => {
    const title = extractTag(item, 'title');
    const link = extractTag(item, 'link') || extractCDATA(item, 'link');
    const pubDate = extractTag(item, 'pubDate');
    const description = extractCDATA(item, 'description') || extractTag(item, 'description') || '';

    // Extract company from title: "Company: Job Title at Company"
    // WWR format: <title><![CDATA[Company: Job Title]]></title>
    const rawTitle = extractCDATA(item, 'title') || title;
    let company = '';
    let jobTitle = rawTitle;

    const colonIdx = rawTitle?.indexOf(': ');
    if (colonIdx > 0) {
      company = rawTitle.substring(0, colonIdx).trim();
      jobTitle = rawTitle.substring(colonIdx + 2).trim();
    }

    // Extract region from description
    const regionMatch = description.match(/Region:\s*([^<\n]+)/i);
    const location = regionMatch ? regionMatch[1].trim() : 'Remote';

    if (!jobTitle || !link) return;

    // Filter by keyword if provided
    if (keyword) {
      const searchText = `${jobTitle} ${company} ${description}`.toLowerCase();
      if (!searchText.includes(keyword)) return;
    }

    // Clean URL (RSS items sometimes have HTML anchors embedded)
    const cleanUrl = link.startsWith('http') ? link : `https://weworkremotely.com${link}`;

    jobs.push({
      id: `wwr-${index}-${Date.now()}`,
      source: 'weworkremotely' as const,
      title: jobTitle,
      company: company || 'Unknown Company',
      description: stripHtml(description).slice(0, 400),
      url: cleanUrl,
      location,
      jobType: 'Remote',
      tags: [],
      postedAt: pubDate ? new Date(pubDate) : undefined,
      country: 'remote',
    });
  });

  return jobs;
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return match ? match[1].trim() : '';
}

function extractCDATA(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`));
  return match ? match[1].trim() : '';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
