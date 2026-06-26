// Consultancy discovery agent — proposes new Portuguese IT consultancies, then
// VALIDATES each against its real ATS before persisting. Only candidates whose
// portal actually returns jobs are saved, as INACTIVE CompanyPortal rows for the
// operator to review and activate in /admin/jobs. This keeps the seed growing
// without hallucinated or dead entries leaking into the live scan.
//
// Two stages:
//   1. An LLM (Together) lists candidate firms + careers URLs from its knowledge.
//   2. Each candidate is detected + fetched live; survivors are inserted inactive.

import Together from 'together-ai';
import prisma from '../../db';
import { detectPortalType, fetchPortalJobs } from './portal-scanner';
import { isAIExtractionAvailable } from './ai-extraction';
import { trackAIUsage, estimateTokens, checkQuotaLimits } from '../ai-tracking';
import seed from '../../data/pt-consultancies.json';

interface TitleFilters {
  include: string[];
  exclude: string[];
}
const DEFAULT_FILTERS = seed.defaultTitleFilters as TitleFilters;

interface Candidate {
  company: string;
  careersUrl: string;
}

export interface DiscoveryResult {
  proposed: number;
  added: { company: string; portalType: string; jobs: number }[];
  skipped: { company: string; reason: string }[];
  error?: string;
}

function getClient(): Together | null {
  const apiKey = process.env.TOGETHER_API_KEY;
  return apiKey ? new Together({ apiKey }) : null;
}

// Pull the first JSON array out of an LLM response (tolerates code fences/prose).
function parseCandidates(text: string): Candidate[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const arr = JSON.parse(text.slice(start, end + 1)) as unknown[];
    return arr
      .map((x) => x as Record<string, unknown>)
      .filter((x) => typeof x.company === 'string' && typeof x.careersUrl === 'string')
      .map((x) => ({ company: (x.company as string).trim(), careersUrl: (x.careersUrl as string).trim() }));
  } catch {
    return [];
  }
}

async function proposeCandidates(client: Together, count: number): Promise<Candidate[]> {
  const model = process.env.TOGETHER_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
  const prompt = `List up to ${count} IT consultancies and software/tech-services companies that hire software engineers in Portugal (Lisboa, Porto, Coimbra, Braga or remote-PT).

Prefer companies whose careers/jobs page is hosted on a known ATS: Greenhouse (boards.greenhouse.io/<slug>), Lever (jobs.lever.co/<slug>), Ashby (jobs.ashbyhq.com/<slug>), SmartRecruiters (jobs.smartrecruiters.com/<Company>) or Recruitee (<slug>.recruitee.com). If you don't know the ATS, give the company's own careers page URL.

Return ONLY a JSON array, no prose, each item: {"company": string, "careersUrl": string}. Use the real ATS slug when you know it.`;

  const start = Date.now();
  let success = true;
  let errorMessage: string | undefined;
  let outputText = '';
  try {
    const resp = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 2048,
    });
    outputText = resp.choices?.[0]?.message?.content || '';
    return parseCandidates(outputText);
  } catch (e) {
    success = false;
    errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return [];
  } finally {
    trackAIUsage({
      feature: 'consultancy-discovery',
      model,
      inputTokens: estimateTokens(prompt),
      outputTokens: estimateTokens(outputText),
      latencyMs: Date.now() - start,
      success,
      error: errorMessage,
    }).catch(() => {});
  }
}

// Validate a candidate against its real ATS; return matched jobs (or null).
async function validate(c: Candidate): Promise<{ portalType: string; slug: string | null; jobs: number } | null> {
  const { type, slug } = detectPortalType(c.careersUrl);
  // Custom (AI-scraped) candidates need a Together key and are noisier — only
  // accept them when AI extraction is available.
  if (type === 'custom' && !isAIExtractionAvailable()) return null;
  try {
    const jobs = await fetchPortalJobs(
      { portalType: type, portalSlug: slug, careersUrl: c.careersUrl, company: c.company },
      DEFAULT_FILTERS
    );
    if (jobs.length === 0) return null;
    return { portalType: type, slug, jobs: jobs.length };
  } catch {
    return null;
  }
}

/** Discover and persist (as inactive) new PT IT consultancy portals. */
export async function discoverConsultancies(opts: { count?: number } = {}): Promise<DiscoveryResult> {
  const result: DiscoveryResult = { proposed: 0, added: [], skipped: [] };

  const client = getClient();
  if (!client) {
    result.error = 'TOGETHER_API_KEY not configured';
    return result;
  }

  const quota = await checkQuotaLimits();
  if (!quota.withinLimits) {
    result.error = 'AI quota exceeded';
    return result;
  }

  const candidates = await proposeCandidates(client, opts.count ?? 20);
  result.proposed = candidates.length;
  if (candidates.length === 0) {
    result.error = 'no candidates proposed';
    return result;
  }

  // Existing portals — skip dups by URL or company name (case-insensitive).
  const existing = await prisma.companyPortal.findMany({ select: { careersUrl: true, company: true } });
  const seenUrls = new Set(existing.map((e) => e.careersUrl.toLowerCase()));
  const seenCompanies = new Set(existing.map((e) => e.company.toLowerCase()));

  for (const c of candidates) {
    if (seenUrls.has(c.careersUrl.toLowerCase()) || seenCompanies.has(c.company.toLowerCase())) {
      result.skipped.push({ company: c.company, reason: 'already known' });
      continue;
    }

    const valid = await validate(c);
    if (!valid) {
      result.skipped.push({ company: c.company, reason: 'no jobs / unreachable ATS' });
      continue;
    }

    await prisma.companyPortal.create({
      data: {
        company: c.company,
        careersUrl: c.careersUrl,
        portalType: valid.portalType,
        portalSlug: valid.slug,
        titleFilters: JSON.stringify(DEFAULT_FILTERS),
        isActive: false, // pending operator review
      },
    });
    // Avoid re-adding within the same run if the LLM repeats a firm.
    seenUrls.add(c.careersUrl.toLowerCase());
    seenCompanies.add(c.company.toLowerCase());
    result.added.push({ company: c.company, portalType: valid.portalType, jobs: valid.jobs });
  }

  return result;
}
