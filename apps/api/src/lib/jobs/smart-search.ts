// Smart Job Search - AI-powered resume-based search

import type {
  JobListing,
  JobSearchParams,
  JobSource,
  ResumeData,
  SmartSearchResult,
  SmartSearchOptions
} from './types';
import { filterJobsByAge } from './helpers';
import { deduplicateJobs } from './deduplication';
import { scoreJobs, calculateMatchPercentage } from './scoring';
import { searchJobs } from './aggregator';

// Maps PT/BR variants for common tech roles
const ROLE_VARIANTS: Record<string, string[]> = {
  developer: ['developer', 'desenvolvedor', 'programador'],
  engineer: ['engineer', 'engenheiro'],
  'full-stack': ['full-stack', 'fullstack', 'full stack'],
  backend: ['backend', 'back-end', 'back end'],
  frontend: ['frontend', 'front-end', 'front end'],
  mobile: ['mobile', 'mobile developer'],
  devops: ['devops', 'dev ops'],
  software: ['software', 'software engineer', 'engenheiro de software'],
};

/**
 * Extract keywords from resume data
 */
export function extractKeywordsFromResume(resume: ResumeData): string[] {
  const keywords = new Set<string>();

  // Extract from skills (prioritize higher level skills)
  const sortedSkills = [...resume.skills].sort((a, b) => b.level - a.level);
  for (const skill of sortedSkills) {
    keywords.add(skill.name.toLowerCase());
  }

  // Extract technology keywords from job titles
  const titleKeywords = [
    'developer', 'engineer', 'programmer', 'full-stack', 'fullstack',
    'backend', 'frontend', 'mobile', 'devops', 'data', 'software'
  ];
  for (const exp of resume.experience) {
    for (const kw of titleKeywords) {
      if (exp.title.toLowerCase().includes(kw)) {
        keywords.add(kw);
      }
    }
  }

  // Extract from certifications
  for (const cert of resume.certifications) {
    const certKeywords = cert.name.match(
      /\b(java|react|node|python|docker|kubernetes|aws|azure|php|laravel|flutter|dart|typescript|javascript|angular|vue|go|rust|c#|\.net|sql|mongodb|postgresql|redis)\b/gi
    );
    if (certKeywords) {
      certKeywords.forEach(kw => keywords.add(kw.toLowerCase()));
    }
  }

  return Array.from(keywords);
}

/**
 * Generate diverse search queries (EN + PT/BR variants) from keywords
 */
export function generateSearchQueries(keywords: string[], country?: string): string[] {
  const queries = new Set<string>();

  // Top 8 skills as individual queries (was 5)
  const topKeywords = keywords.slice(0, 8);
  topKeywords.forEach(kw => queries.add(kw));

  // Skill combinations with the top keyword
  if (topKeywords.length >= 2) {
    queries.add(`${topKeywords[0]} ${topKeywords[1]}`);
  }
  if (topKeywords.length >= 3) {
    queries.add(`${topKeywords[0]} ${topKeywords[2]}`);
  }

  // Role-based queries — add PT/BR variants for local searches
  const isLocal = country === 'pt' || country === 'br';
  const roleQueries = [
    'full-stack developer',
    'backend developer',
    'frontend developer',
    'software engineer',
  ];
  roleQueries.forEach(q => queries.add(q));

  if (isLocal || !country || country === 'all') {
    // Portuguese variants boost results on PT/BR boards
    queries.add('desenvolvedor full-stack');
    queries.add('desenvolvedor backend');
    queries.add('programador');
  }

  // Add role variants based on skills found
  for (const [role, variants] of Object.entries(ROLE_VARIANTS)) {
    if (keywords.some(k => k.includes(role))) {
      // Only add one variant per role to avoid too many queries
      queries.add(variants[0]);
      if (isLocal && variants.length > 1) queries.add(variants[1]);
    }
  }

  return Array.from(queries);
}

/**
 * Perform smart job search based on resume
 */
export async function smartJobSearch(
  resume: ResumeData,
  options: SmartSearchOptions = {}
): Promise<SmartSearchResult> {
  const {
    country = 'all',
    source = 'all',
    limit = 50,
    maxAgeDays = 0,
  } = options;

  const keywords = extractKeywordsFromResume(resume);
  const queries = generateSearchQueries(keywords, country);

  // Convert source to array for easier handling
  const sources = Array.isArray(source) ? source : [source];
  const isAllSources = sources.includes('all');

  // Search with top 5 queries in parallel (was 3) for more results
  const MAX_QUERIES = 5;
  const perQueryLimit = Math.ceil((limit * 2) / MAX_QUERIES); // fetch 2× to allow for dedup
  const searchPromises: Promise<JobListing[]>[] = queries.slice(0, MAX_QUERIES).map(query =>
    searchJobs(
      { keyword: query, country, limit: perQueryLimit, maxAgeDays },
      isAllSources ? 'all' : sources
    )
  );

  const results = await Promise.all(searchPromises);
  let allJobs = results.flat();

  // Filter by age if specified
  if (maxAgeDays > 0) {
    allJobs = filterJobsByAge(allJobs, maxAgeDays);
  }

  // Deduplicate
  allJobs = deduplicateJobs(allJobs);

  // Score and sort by relevance
  const scoredJobs = scoreJobs(allJobs, resume);

  return {
    jobs: scoredJobs.slice(0, limit),
    keywords,
  };
}

/**
 * Get personalized job recommendations
 */
export async function getJobRecommendations(
  resume: ResumeData,
  options: SmartSearchOptions = {}
): Promise<{
  jobs: JobListing[];
  matchPercentages: Map<string, number>;
}> {
  const result = await smartJobSearch(resume, options);

  // Calculate match percentages for each job
  const matchPercentages = new Map<string, number>();
  for (const job of result.jobs) {
    matchPercentages.set(job.id, calculateMatchPercentage(job, resume));
  }

  return {
    jobs: result.jobs,
    matchPercentages,
  };
}

/**
 * Analyze resume and suggest improvements for job search
 */
export function analyzeResumeForJobSearch(resume: ResumeData): {
  strengths: string[];
  improvements: string[];
  suggestedRoles: string[];
} {
  const strengths: string[] = [];
  const improvements: string[] = [];
  const suggestedRoles: string[] = [];

  // Analyze skills
  const highLevelSkills = resume.skills.filter(s => s.level >= 4);
  const lowLevelSkills = resume.skills.filter(s => s.level <= 2);

  if (highLevelSkills.length > 0) {
    strengths.push(`Strong skills in: ${highLevelSkills.map(s => s.name).join(', ')}`);
  }

  if (lowLevelSkills.length > highLevelSkills.length) {
    improvements.push('Consider focusing on fewer technologies and developing deeper expertise');
  }

  // Analyze experience
  if (resume.experience.length >= 3) {
    strengths.push('Good amount of professional experience');
  } else if (resume.experience.length < 2) {
    improvements.push('Consider highlighting more projects or freelance work');
  }

  // Analyze certifications
  if (resume.certifications.length > 0) {
    strengths.push(`Certifications: ${resume.certifications.map(c => c.name).join(', ')}`);
  } else {
    improvements.push('Consider adding relevant certifications to strengthen your profile');
  }

  // Suggest roles based on skills
  const skillNames = resume.skills.map(s => s.name.toLowerCase());

  if (skillNames.some(s => ['react', 'vue', 'angular'].includes(s))) {
    suggestedRoles.push('Frontend Developer');
  }
  if (skillNames.some(s => ['node', 'python', 'java', 'php', 'go'].includes(s))) {
    suggestedRoles.push('Backend Developer');
  }
  if (skillNames.some(s => ['docker', 'kubernetes', 'aws', 'azure'].includes(s))) {
    suggestedRoles.push('DevOps Engineer');
  }
  if (skillNames.some(s => ['react', 'node'].includes(s)) ||
      skillNames.some(s => s.includes('full'))) {
    suggestedRoles.push('Full-Stack Developer');
  }
  if (skillNames.some(s => ['flutter', 'react native', 'swift', 'kotlin'].includes(s))) {
    suggestedRoles.push('Mobile Developer');
  }

  return {
    strengths,
    improvements,
    suggestedRoles: Array.from(new Set(suggestedRoles)),
  };
}
