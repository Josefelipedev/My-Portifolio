// Job Deduplication System

import type { JobListing } from './types';
import { generateJobHash } from './helpers';

/**
 * Normalize job key for comparison
 * Creates a unique identifier based on title and company
 */
export function normalizeJobKey(job: JobListing): string {
  const title = job.title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 50); // Limit length for comparison
  const company = job.company
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 30);
  return `${title}-${company}`;
}

/**
 * Calculate completeness score for a job listing
 * Used to determine which duplicate to keep
 */
export function getCompletenessScore(job: JobListing): number {
  let score = 0;

  // Base fields
  if (job.title) score += 2;
  if (job.company) score += 2;
  if (job.url) score += 1;

  // Description quality
  if (job.description) {
    if (job.description.length > 500) score += 3;
    else if (job.description.length > 200) score += 2;
    else if (job.description.length > 50) score += 1;
  }

  // Additional valuable fields
  if (job.companyLogo) score += 1;
  if (job.salary) score += 2;
  if (job.location) score += 1;
  if (job.jobType) score += 1;
  if (job.postedAt) score += 1;
  if (job.tags && job.tags.length > 0) score += 1;

  // Source reliability bonus
  const reliableSources = ['linkedin', 'remoteok', 'remotive'];
  if (reliableSources.includes(job.source)) score += 2;

  return score;
}

/**
 * Remove duplicate jobs, keeping the most complete version
 */
export function deduplicateJobs(jobs: JobListing[]): JobListing[] {
  const seen = new Map<string, JobListing>();

  for (const job of jobs) {
    const key = normalizeJobKey(job);
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, job);
    } else {
      // Keep the one with higher completeness score
      if (getCompletenessScore(job) > getCompletenessScore(existing)) {
        seen.set(key, job);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Advanced deduplication with similarity matching
 * Uses Levenshtein distance for fuzzy matching
 */
export function deduplicateJobsAdvanced(
  jobs: JobListing[],
  similarityThreshold: number = 0.85
): JobListing[] {
  const result: JobListing[] = [];
  const processed = new Set<number>();

  for (let i = 0; i < jobs.length; i++) {
    if (processed.has(i)) continue;

    const job = jobs[i];
    const key = normalizeJobKey(job);
    let bestJob = job;
    let bestScore = getCompletenessScore(job);

    // Check for similar jobs
    for (let j = i + 1; j < jobs.length; j++) {
      if (processed.has(j)) continue;

      const otherJob = jobs[j];
      const otherKey = normalizeJobKey(otherJob);

      // Check if keys are similar enough
      const similarity = calculateSimilarity(key, otherKey);
      if (similarity >= similarityThreshold) {
        processed.add(j);
        const otherScore = getCompletenessScore(otherJob);
        if (otherScore > bestScore) {
          bestJob = otherJob;
          bestScore = otherScore;
        }
      }
    }

    processed.add(i);
    result.push(bestJob);
  }

  return result;
}

/**
 * Calculate similarity between two strings (0-1)
 * Uses simplified Jaccard similarity on character trigrams
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length < 3 || str2.length < 3) {
    return str1 === str2 ? 1 : 0;
  }

  const trigrams1 = new Set(getTrigrams(str1));
  const trigrams2 = new Set(getTrigrams(str2));

  let intersection = 0;
  const trigrams1Array = Array.from(trigrams1);
  for (const trigram of trigrams1Array) {
    if (trigrams2.has(trigram)) {
      intersection++;
    }
  }

  const union = trigrams1.size + trigrams2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Get character trigrams from a string
 */
function getTrigrams(str: string): string[] {
  const trigrams: string[] = [];
  for (let i = 0; i <= str.length - 3; i++) {
    trigrams.push(str.slice(i, i + 3));
  }
  return trigrams;
}

/**
 * Deduplicate jobs by external ID (exact match)
 */
export function deduplicateByExternalId(jobs: JobListing[]): JobListing[] {
  const seen = new Set<string>();
  return jobs.filter(job => {
    if (seen.has(job.id)) return false;
    seen.add(job.id);
    return true;
  });
}
