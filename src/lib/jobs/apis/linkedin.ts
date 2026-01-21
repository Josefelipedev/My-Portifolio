// LinkedIn Jobs (Brazil/Portugal) - Guest API

import type { JobListing, JobSearchParams } from '../types';

export async function searchLinkedIn(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const keyword = encodeURIComponent(params.keyword || 'desenvolvedor');
    const location = params.country === 'pt' ? 'Portugal' : 'Brazil';
    const geoId = params.country === 'pt' ? '100364837' : '106057199'; // Portugal or Brazil geoId

    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${keyword}&location=${location}&geoId=${geoId}&start=0&sortBy=R`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`LinkedIn fetch error: ${response.status}`);
    }

    const html = await response.text();
    const jobs = parseLinkedInHTML(html, params.country || 'br');

    return jobs.slice(0, params.limit || 50);
  } catch (error) {
    console.error('LinkedIn scraping error:', error);
    return [];
  }
}

function parseLinkedInHTML(html: string, country: string): JobListing[] {
  const jobs: JobListing[] = [];
  const cards = html.split('<li').slice(1);

  cards.forEach((card, index) => {
    const titleMatch = card.match(/base-search-card__title[^>]*>([^<]+)/);
    const urlMatch = card.match(/base-card__full-link[^>]*href="([^"?]+)/);
    const locationMatch = card.match(/job-search-card__location">([^<]+)/);
    const companyMatch = card.match(/base-search-card__subtitle[^>]*>[^<]*<a[^>]*>([^<]+)/);
    const postedMatch = card.match(/job-search-card__listdate[^>]*datetime="([^"]+)"/);

    if (titleMatch && urlMatch) {
      jobs.push({
        id: `linkedin-${Date.now()}-${index}`,
        source: 'linkedin',
        title: titleMatch[1].trim(),
        company: companyMatch ? companyMatch[1].trim() : 'Empresa no LinkedIn',
        description: '',
        url: urlMatch[1],
        location: locationMatch ? locationMatch[1].trim() : (country === 'pt' ? 'Portugal' : 'Brasil'),
        jobType: 'On-site',
        tags: [],
        postedAt: postedMatch ? new Date(postedMatch[1]) : undefined,
        country: country,
      });
    }
  });

  return jobs;
}
