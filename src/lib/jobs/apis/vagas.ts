// Vagas.com.br Web Scraping (Brazil)
// Returns HTTP 403 to server-side requests — uses Python scraper directly.

import type { JobListing, JobSearchParams } from '../types';
import { searchVagasComBrPython, isPythonScraperAvailable } from './python-scraper';
import { logger } from '@/lib/logger';

export async function searchVagasComBr(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const available = await isPythonScraperAvailable();
    if (!available) {
      logger.warn('vagascombr', 'Python scraper not available');
      return [];
    }

    const results = await searchVagasComBrPython(params);
    logger.info('vagascombr', `Found ${results.length} jobs`, { count: results.length });
    return results;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('vagascombr', `Scraping error: ${err.message}`, { error: err.message });
    return [];
  }
}
