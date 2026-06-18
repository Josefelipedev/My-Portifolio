// Shared API contracts — runtime schemas for public portfolio content.
//
// These mirror the JSON shape returned by the public GET endpoints
// (Prisma models serialized to JSON: Date -> ISO string). They are the
// single source of truth for the boundary between the web frontend and
// the API service, and are framework-agnostic (no Next/Node imports) so
// they can run on both the edge (Workers) and Node.
//
// NOTE: when this repo is split into a monorepo, this directory moves to
// `packages/shared/contracts` unchanged.

import { z } from 'zod';

/** ISO-8601 timestamp string (Prisma DateTime serialized to JSON). */
const isoDate = z.string();

export const projectSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  readme: z.string().nullable(),
  technologies: z.string(), // comma-separated
  repoUrl: z.string().nullable(),
  demoUrl: z.string().nullable(),
  githubId: z.number().int().nullable(),
  source: z.string(),
  aiSummary: z.string().nullable(),
  aiSummarizedAt: isoDate.nullable(),
  imageUrl: z.string().nullable(),
  stars: z.number().int().nullable(),
  featured: z.boolean(),
  rank: z.number().int().nullable(),
  isPrivate: z.boolean(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type Project = z.infer<typeof projectSchema>;

export const experienceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  responsibilities: z.string(), // comma-separated
  challenges: z.string(), // comma-separated
  technologies: z.string(), // comma-separated
  company: z.string().nullable(),
  startDate: isoDate.nullable(),
  endDate: isoDate.nullable(), // null = current position
  location: z.string().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type Experience = z.infer<typeof experienceSchema>;

export const educationSchema = z.object({
  id: z.string(),
  title: z.string(),
  institution: z.string(),
  type: z.string(), // degree | course | certification
  status: z.string(), // completed | in_progress | paused | next
  visible: z.boolean(),
  fieldOfStudy: z.string().nullable(),
  location: z.string().nullable(),
  startDate: isoDate.nullable(),
  endDate: isoDate.nullable(),
  description: z.string().nullable(),
  certificateUrl: z.string().nullable(),
  order: z.number().int(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type Education = z.infer<typeof educationSchema>;

export const skillSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(), // frontend | backend | devops | tools | other
  level: z.number().int().min(1).max(5),
  iconUrl: z.string().nullable(),
  order: z.number().int(),
});
export type Skill = z.infer<typeof skillSchema>;

/**
 * Public subset of SiteConfig — secrets (wakatimeConfig, jobApiKeys) are
 * intentionally excluded from the web-facing contract.
 */
export const publicSiteConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  twitterUrl: z.string().nullable(),
  email: z.string().nullable(),
  location: z.string().nullable(),
});
export type PublicSiteConfig = z.infer<typeof publicSiteConfigSchema>;

/**
 * GET /api/profile envelope: `{ success, data }`. The endpoint currently
 * returns the full SiteConfig row; the public schema strips unknown keys,
 * so secret fields (wakatimeConfig, jobApiKeys) never reach the client even
 * if present on the wire.
 */
export const siteConfigResponseSchema = z.object({
  success: z.boolean(),
  data: publicSiteConfigSchema.nullable(),
});
export type SiteConfigResponse = z.infer<typeof siteConfigResponseSchema>;

/**
 * A repo row from the GitHubRepoCache table (populated by the auth-gated
 * import flow). The public API reads this cache so the homepage never hits
 * GitHub directly. `topics` is stored comma-separated, mirroring the column.
 */
export const githubRepoSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  fullName: z.string(),
  description: z.string().nullable(),
  htmlUrl: z.string(),
  homepage: z.string().nullable(),
  language: z.string().nullable(),
  topics: z.string().nullable(), // comma-separated
  stargazers: z.number().int(),
  forksCount: z.number().int(),
  updatedAt: isoDate,
  cachedAt: isoDate,
});
export type GitHubRepo = z.infer<typeof githubRepoSchema>;

/**
 * A yearly stats row from the WakaTimeYearCache table. The JSON-array columns
 * (languages, editors, etc.) are stored as strings and passed through as-is —
 * the web client parses them, matching the existing lib/wakatime.ts behaviour.
 */
export const wakatimeYearSchema = z.object({
  id: z.string(), // e.g. "year_2024"
  year: z.number().int(),
  totalSeconds: z.number().int(),
  totalHours: z.string(),
  dailyAverage: z.string(),
  bestDayDate: z.string().nullable(),
  bestDaySeconds: z.number().int().nullable(),
  bestDayText: z.string().nullable(),
  languages: z.string(), // JSON array (string)
  editors: z.string(), // JSON array (string)
  operatingSystems: z.string(), // JSON array (string)
  projects: z.string(), // JSON array (string)
  categories: z.string(), // JSON array (string)
  rangeStart: z.string(),
  rangeEnd: z.string(),
  rangeText: z.string(),
  cachedAt: isoDate,
});
export type WakatimeYear = z.infer<typeof wakatimeYearSchema>;

// List responses (the public GET endpoints return raw arrays).
export const projectListSchema = z.array(projectSchema);
export const experienceListSchema = z.array(experienceSchema);
export const educationListSchema = z.array(educationSchema);
export const skillListSchema = z.array(skillSchema);
export const githubRepoListSchema = z.array(githubRepoSchema);
export const wakatimeYearListSchema = z.array(wakatimeYearSchema);

/** Error envelope returned by the API on non-2xx (see api-utils.error). */
export const apiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
