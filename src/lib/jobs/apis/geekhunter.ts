// GeekHunter Web Scraping (Brazil - Tech Jobs)
// HTML responses are 14MB+ with anti-bot protection — uses Python scraper directly.

import type { JobListing, JobSearchParams } from '../types';
import { searchGeekHunterPython, isPythonScraperAvailable } from './python-scraper';
import { logger } from '@/lib/logger';

export async function searchGeekHunter(params: JobSearchParams): Promise<JobListing[]> {
  if (params.country && params.country !== 'br' && params.country !== 'all') {
    return [];
  }

  try {
    const available = await isPythonScraperAvailable();
    if (!available) {
      logger.warn('geekhunter', 'Python scraper not available');
      return [];
    }

    const results = await searchGeekHunterPython(params);
    logger.info('geekhunter', `Found ${results.length} jobs`, { count: results.length });
    return results;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('geekhunter', `Scraping error: ${err.message}`, { error: err.message });
    return [];
  }
}
