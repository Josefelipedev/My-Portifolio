// Job Relevance Scoring System

import type { JobListing, ResumeData } from './types';
import { detectExperienceLevel, detectJobType } from './helpers';

/**
 * Scoring criteria weights
 */
const SCORING_WEIGHTS = {
  // Source reliability
  reliableSource: 5,       // LinkedIn, RemoteOK, Remotive
  moderateSource: 3,       // Adzuna, Arbeitnow
  unknownSource: 1,        // Other sources

  // Content quality
  descriptionLong: 3,      // Description > 200 chars
  descriptionMedium: 2,    // Description 100-200 chars
  descriptionShort: 1,     // Description < 100 chars

  // Information completeness
  hasSalary: 2,
  hasLogo: 1,
  hasLocation: 1,
  hasTags: 1,
  hasPostedDate: 1,

  // Freshness (posted date)
  postedToday: 3,
  postedThisWeek: 2,
  postedThisMonth: 1,

  // Resume match (per keyword)
  keywordMatch: 2,
  skillMatch: 3,
  titleMatch: 5,
};

const RELIABLE_SOURCES = ['linkedin', 'remoteok', 'remotive'];
const MODERATE_SOURCES = ['adzuna', 'arbeitnow', 'jsearch'];

/**
 * Calculate base relevance score for a job listing
 */
export function calculateBaseScore(job: JobListing): number {
  let score = 0;

  // Source reliability
  if (RELIABLE_SOURCES.includes(job.source)) {
    score += SCORING_WEIGHTS.reliableSource;
  } else if (MODERATE_SOURCES.includes(job.source)) {
    score += SCORING_WEIGHTS.moderateSource;
  } else {
    score += SCORING_WEIGHTS.unknownSource;
  }

  // Description quality
  const descLength = job.description?.length || 0;
  if (descLength > 200) {
    score += SCORING_WEIGHTS.descriptionLong;
  } else if (descLength > 100) {
    score += SCORING_WEIGHTS.descriptionMedium;
  } else if (descLength > 0) {
    score += SCORING_WEIGHTS.descriptionShort;
  }

  // Information completeness
  if (job.salary) score += SCORING_WEIGHTS.hasSalary;
  if (job.companyLogo) score += SCORING_WEIGHTS.hasLogo;
  if (job.location) score += SCORING_WEIGHTS.hasLocation;
  if (job.tags && job.tags.length > 0) score += SCORING_WEIGHTS.hasTags;
  if (job.postedAt) score += SCORING_WEIGHTS.hasPostedDate;

  // Freshness
  if (job.postedAt) {
    const daysSincePosted = Math.floor(
      (Date.now() - new Date(job.postedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSincePosted === 0) {
      score += SCORING_WEIGHTS.postedToday;
    } else if (daysSincePosted <= 7) {
      score += SCORING_WEIGHTS.postedThisWeek;
    } else if (daysSincePosted <= 30) {
      score += SCORING_WEIGHTS.postedThisMonth;
    }
  }

  return score;
}

/**
 * Calculate resume match score for a job
 */
export function calculateResumeMatchScore(
  job: JobListing,
  resume: ResumeData
): number {
  let score = 0;
  const jobText = `${job.title} ${job.description || ''} ${job.tags?.join(' ') || ''}`.toLowerCase();

  // Match skills
  for (const skill of resume.skills) {
    const skillName = skill.name.toLowerCase();
    if (jobText.includes(skillName)) {
      // Weight by skill level
      score += SCORING_WEIGHTS.skillMatch * (skill.level / 5);
    }
  }

  // Match experience titles
  for (const exp of resume.experience) {
    const titleWords = exp.title.toLowerCase().split(/\s+/);
    for (const word of titleWords) {
      if (word.length > 3 && jobText.includes(word)) {
        score += SCORING_WEIGHTS.titleMatch;
        break; // Only count once per experience
      }
    }
  }

  // Match certifications
  for (const cert of resume.certifications) {
    const certKeywords = cert.name.match(
      /\b(java|react|node|python|docker|kubernetes|aws|azure|php|laravel|flutter|dart|typescript|javascript|angular|vue|go|rust|c#|\.net|sql|mongodb|postgresql|redis)\b/gi
    );
    if (certKeywords) {
      for (const kw of certKeywords) {
        if (jobText.includes(kw.toLowerCase())) {
          score += SCORING_WEIGHTS.keywordMatch;
        }
      }
    }
  }

  return score;
}

/**
 * Calculate match percentage between job and resume (0-100)
 */
export function calculateMatchPercentage(
  job: JobListing,
  resume: ResumeData
): number {
  const jobText = `${job.title} ${job.description || ''} ${job.tags?.join(' ') || ''}`.toLowerCase();

  const totalSkills = resume.skills.length;
  if (totalSkills === 0) return 0;

  let matchedSkills = 0;
  for (const skill of resume.skills) {
    if (jobText.includes(skill.name.toLowerCase())) {
      matchedSkills++;
    }
  }

  // Calculate base percentage from skills
  let percentage = (matchedSkills / totalSkills) * 100;

  // Bonus for matching job titles
  for (const exp of resume.experience) {
    if (job.title.toLowerCase().includes(exp.title.toLowerCase().split(' ')[0])) {
      percentage += 10;
    }
  }

  return Math.min(100, Math.round(percentage));
}

/**
 * Score and sort jobs by relevance
 */
export function scoreJobs(jobs: JobListing[], resume?: ResumeData): JobListing[] {
  return jobs.map(job => {
    let score = calculateBaseScore(job);

    if (resume) {
      score += calculateResumeMatchScore(job, resume);
    }

    return {
      ...job,
      relevanceScore: score,
    };
  }).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
}

/**
 * Get jobs with match percentage above threshold
 */
export function filterByMatchPercentage(
  jobs: JobListing[],
  resume: ResumeData,
  minPercentage: number = 20
): JobListing[] {
  return jobs.filter(job => {
    const percentage = calculateMatchPercentage(job, resume);
    return percentage >= minPercentage;
  });
}

/**
 * Get top N most relevant jobs
 */
export function getTopRelevantJobs(
  jobs: JobListing[],
  resume?: ResumeData,
  limit: number = 10
): JobListing[] {
  const scored = scoreJobs(jobs, resume);
  return scored.slice(0, limit);
}

/**
 * Categorize jobs by match quality
 */
export function categorizeJobsByMatch(
  jobs: JobListing[],
  resume: ResumeData
): {
  excellent: JobListing[];
  good: JobListing[];
  fair: JobListing[];
  low: JobListing[];
} {
  const result = {
    excellent: [] as JobListing[],
    good: [] as JobListing[],
    fair: [] as JobListing[],
    low: [] as JobListing[],
  };

  for (const job of jobs) {
    const percentage = calculateMatchPercentage(job, resume);
    if (percentage >= 70) {
      result.excellent.push(job);
    } else if (percentage >= 50) {
      result.good.push(job);
    } else if (percentage >= 30) {
      result.fair.push(job);
    } else {
      result.low.push(job);
    }
  }

  return result;
}
