// Job Search Library - Main exports

// Types
export type {
  JobListing,
  JobSourceType,
  JobSource,
  JobSearchParams,
  JobSearchResult,
  ApiStatus,
  ResumeData,
  SmartSearchResult,
  SmartSearchOptions,
  AIExtractedJob,
  JobFilters,
} from './types';

// Aggregator (main search function)
export {
  searchJobs,
  searchJobsByCountry,
  getApiStatus,
} from './aggregator';

// Smart Search
export {
  smartJobSearch,
  extractKeywordsFromResume,
  generateSearchQueries,
  getJobRecommendations,
  analyzeResumeForJobSearch,
} from './smart-search';

// Helpers
export {
  formatSalary,
  formatNumber,
  cleanHtmlText,
  filterJobsByAge,
  parsePortugueseDate,
  extractSalaryFromText,
  detectExperienceLevel,
  detectJobType,
  sortJobs,
  generateJobHash,
  daysSince,
} from './helpers';

// Deduplication
export {
  normalizeJobKey,
  getCompletenessScore,
  deduplicateJobs,
  deduplicateJobsAdvanced,
  deduplicateByExternalId,
} from './deduplication';

// Scoring
export {
  calculateBaseScore,
  calculateResumeMatchScore,
  calculateMatchPercentage,
  scoreJobs,
  filterByMatchPercentage,
  getTopRelevantJobs,
  categorizeJobsByMatch,
} from './scoring';

// Cache
export {
  getCachedResults,
  setCachedResults,
  clearExpiredCache,
  clearCache,
  getCacheStats,
  mergeAndCacheJobs,
} from './cache';

// AI Extraction
export {
  extractJobsWithAI,
  isAIExtractionAvailable,
} from './ai-extraction';

// Individual API exports (for direct access if needed)
export { searchRemoteOK } from './apis/remoteok';
export { searchRemotive, remotiveCategories, type RemotiveCategory } from './apis/remotive';
export { searchArbeitnow } from './apis/arbeitnow';
export { searchAdzuna } from './apis/adzuna';
export { searchJooble } from './apis/jooble';
export { searchJSearch } from './apis/jsearch';
export { searchNetEmpregos } from './apis/net-empregos';
export { searchVagasComBr } from './apis/vagas';
export { searchGeekHunter } from './apis/geekhunter';
export { searchLinkedIn } from './apis/linkedin';

// Python Scraper exports
export {
  searchPythonScraper,
  isPythonScraperAvailable,
  getPythonScraperSources,
  searchGeekHunterPython,
  searchVagasComBrPython,
} from './apis/python-scraper';
