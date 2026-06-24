// Zod request schemas for the jobs routes. Used with parseBody() (lib/api-utils)
// which throws Errors.BadRequest with the first issue's message on failure.
//
// Required string fields use req() so both a missing key and an empty string
// yield the same "<field> is required" message — matching the previous
// validateRequired() behaviour. Optional string fields use .nullish() to keep
// tolerating explicit nulls the old `(x as string) ?? undefined` mapping allowed.

import { z } from 'zod';

/** Required non-empty string with a "<field> is required" message. */
const req = (field: string) =>
  z.string({ error: `${field} is required` }).min(1, `${field} is required`);

/** Non-empty string[] (rejects missing/empty array) with a shared message. */
const idsArray = (message = 'IDs array is required') =>
  z.array(z.string(), { error: message }).min(1, message);

// ── saved jobs ──────────────────────────────────────────────────────────────

export const savedJobCreateSchema = z.object({
  externalId: req('externalId'),
  source: req('source'),
  title: req('title'),
  company: req('company'),
  url: req('url'),
  companyLogo: z.string().nullish(),
  description: z.string().nullish(),
  location: z.string().nullish(),
  jobType: z.string().nullish(),
  salary: z.string().nullish(),
  tags: z.union([z.array(z.string()), z.string()]).nullish(),
  postedAt: z.string().nullish(),
  notes: z.string().nullish(),
});

export const savedJobUpdateSchema = z.object({
  notes: z.string().optional(),
  contactEmail: z.string().nullish(),
  contactPhone: z.string().nullish(),
});

export const idsSchema = z.object({ ids: idsArray() });

// ── applications ──────────────────────────────────────────────────────────────

export const JOB_STATUSES = ['saved', 'applied', 'interview', 'offer', 'rejected'] as const;

export const applicationCreateSchema = z.object({
  title: req('title'),
  company: req('company'),
  url: z.string().nullish(),
  location: z.string().nullish(),
  salary: z.string().nullish(),
  status: z.string().optional(),
  appliedAt: z.string().nullish(),
  notes: z.string().nullish(),
  nextStep: z.string().nullish(),
  nextStepDate: z.string().nullish(),
});

export const applicationsBulkUpdateSchema = z.object({
  ids: idsArray(),
  status: z.enum(JOB_STATUSES, { error: 'Invalid status' }),
});

export const applicationUpdateSchema = z.object({
  title: z.string().optional(),
  company: z.string().optional(),
  url: z.string().nullish(),
  location: z.string().nullish(),
  salary: z.string().nullish(),
  status: z.string().optional(),
  statusNote: z.string().optional(),
  appliedAt: z.string().nullish(),
  notes: z.string().nullish(),
  nextStep: z.string().nullish(),
  nextStepDate: z.string().nullish(),
});

export const applySchema = z.object({
  recipient: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  cvPdfBase64: z.string().optional(),
  cvFilename: z.string().optional(),
  sendApplicationEmail: z.boolean().optional(),
  appliedAt: z.string().optional(),
});

// ── company portals ───────────────────────────────────────────────────────────

export const portalCreateSchema = z.object({
  company: req('company'),
  careersUrl: req('careersUrl'),
  portalType: z.string().optional(),
  portalSlug: z.string().optional(),
  titleFilters: z.unknown().optional(),
});

export const portalUpdateSchema = z.object({
  company: z.string().optional(),
  careersUrl: z.string().optional(),
  isActive: z.boolean().optional(),
  titleFilters: z.unknown().optional(),
  portalType: z.string().optional(),
  portalSlug: z.string().optional(),
});

// ── AI (analyze / batch / CV) ─────────────────────────────────────────────────

export const analyzeSchema = z.object({ jobId: req('jobId') });

export const batchCvSchema = z.object({
  jobIds: idsArray('jobIds array is required').max(10, 'Maximum 10 jobs per batch CV generation'),
});

export const batchAnalyzeSchema = z.object({
  jobIds: idsArray('jobIds array is required').max(20, 'Maximum 20 jobs per batch'),
});

// ── AI inline (email / cover letter / extract) ────────────────────────────────

const jobInfoRequired = 'Job title and company are required';
export const aiJobInfoSchema = z.object({
  jobTitle: z.string({ error: jobInfoRequired }).min(1, jobInfoRequired),
  company: z.string({ error: jobInfoRequired }).min(1, jobInfoRequired),
  description: z.string().optional(),
  jobUrl: z.string().optional(),
});

const extractMin = 'Please provide job information text (minimum 20 characters)';
export const aiExtractSchema = z.object({
  text: z.string({ error: extractMin }).trim().min(20, extractMin),
});

// ── misc: history / alerts / api-keys ─────────────────────────────────────────

export const historyCreateSchema = z.object({
  keyword: req('Keyword'),
  countries: z.string().optional(),
  sources: z.string().optional(),
  filters: z.unknown().optional(),
  resultCount: z.number().optional(),
});

export const alertRunSchema = z.object({
  alertId: z.string().optional(),
  id: z.string().optional(),
});

export const alertCreateSchema = z.object({
  name: req('name'),
  keyword: req('keyword'),
  countries: z.string().optional(),
  sources: z.string().optional(),
  filters: z.unknown().optional(),
  scheduleEnabled: z.boolean().optional(),
  scheduleHours: z.string().optional(),
  scheduleDays: z.string().optional(),
  emailOnMatch: z.boolean().optional(),
});

const alertIdRequired = 'Alert ID is required';
export const alertUpdateSchema = z.object({
  id: z.string({ error: alertIdRequired }).min(1, alertIdRequired),
  name: z.string().optional(),
  keyword: z.string().optional(),
  countries: z.string().optional(),
  sources: z.string().optional(),
  filters: z.unknown().optional(),
  isActive: z.boolean().optional(),
  scheduleEnabled: z.boolean().optional(),
  scheduleHours: z.string().optional(),
  scheduleDays: z.string().optional(),
  emailOnMatch: z.boolean().optional(),
});

export const apiKeysSchema = z.record(z.string(), z.string());

// ── resume editor ─────────────────────────────────────────────────────────────

// Keeps every field (passthrough) since the handler re-serialises the whole body
// to ResumeConfig; only requires `skills` to be an array.
export const resumeUpdateSchema = z
  .object({
    skills: z.array(z.unknown(), { error: 'skills must be an array' }),
  })
  .passthrough();
