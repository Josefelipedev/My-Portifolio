// Job Search Library — API service exports. Ported from the web app's
// src/lib/jobs/index.ts, limited to the search/aggregation surface used by the
// API routes (the web-only api-keys / portal-scanner / alert-suggestions
// modules are not part of Phase 2).

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
  getLastSourceErrors,
  type SourceError,
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
