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
  location?: string[];
}
const DEFAULT_FILTERS = seed.defaultTitleFilters as TitleFilters;

// PT location allow-list applied to country-blind ATSs (Greenhouse/Lever/Ashby/
// Recruitee/custom) so the agent only counts/keeps Portugal-based jobs. The
// SmartRecruiters adapter already filters by country=pt, so it needs no list.
const PT_LOCATIONS = ['portugal', 'lisbon', 'lisboa', 'porto', 'braga', 'coimbra', 'aveiro'];

function filtersForType(type: string): TitleFilters {
  return type === 'smartrecruiters' ? DEFAULT_FILTERS : { ...DEFAULT_FILTERS, location: PT_LOCATIONS };
}

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

async function proposeCandidates(client: Together, count: number, exclude: string[] = []): Promise<Candidate[]> {
  const model = process.env.TOGETHER_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
  const excludeLine = exclude.length
    ? `\n- Do NOT propose any of these already-known companies: ${exclude.join(', ')}.`
    : '';
  const prompt = `You are helping a software engineer in Portugal find employers. List up to ${count} DISTINCT small/mid-sized software-development companies, IT outsourcing / nearshore consultancies, or tech scale-ups with an engineering office in Portugal (Lisboa, Porto, Coimbra, Braga, Aveiro) or that hire remote-Portugal.

RULES:
- Each company's jobs MUST be on a public ATS. Give the exact URL with the real slug: Greenhouse (boards.greenhouse.io/<slug>), Lever (jobs.lever.co/<slug>), Ashby (jobs.ashbyhq.com/<slug>), SmartRecruiters (jobs.smartrecruiters.com/<Company>) or Recruitee (<slug>.recruitee.com).
- AVOID the Big-4 and global system integrators / mega-enterprises (Accenture, Deloitte, Capgemini, IBM, Microsoft, SAP, Oracle, KPMG, EY, PwC, NTT, Cognizant, Wipro, Infosys, TCS, Ericsson, Siemens) — they use Workday and are NOT reachable, do not include them.
- Favour Portuguese software houses, nearshore consultancies and scale-ups (the kind of company like Talkdesk, Feedzai, Pixelmatters, Devexperts, Pipedrive — but propose DIFFERENT, less obvious ones).${excludeLine}

Return ONLY a JSON array, no prose: [{"company": string, "careersUrl": string}]. Only include companies you are fairly confident have both an engineering presence in Portugal and a real public ATS URL.`;

  const start = Date.now();
  let success = true;
  let errorMessage: string | undefined;
  let outputText = '';
  try {
    const resp = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
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

// Validate a candidate against its real ATS (PT-location-filtered for global
// boards); return matched jobs + the filters to persist (or null).
async function validate(
  c: Candidate
): Promise<{ portalType: string; slug: string | null; jobs: number; filters: TitleFilters } | null> {
  const { type, slug } = detectPortalType(c.careersUrl);
  // Custom (AI-scraped) candidates need a Together key and are noisier — only
  // accept them when AI extraction is available.
  if (type === 'custom' && !isAIExtractionAvailable()) return null;
  const filters = filtersForType(type);
  try {
    const jobs = await fetchPortalJobs(
      { portalType: type, portalSlug: slug, careersUrl: c.careersUrl, company: c.company },
      filters
    );
    if (jobs.length === 0) return null;
    return { portalType: type, slug, jobs: jobs.length, filters };
  } catch {
    return null;
  }
}

/** Discover and persist new PT IT consultancy portals. Validated candidates are
 *  added inactive by default (for review); pass activate:true to add them active
 *  so the scan starts tracking their jobs immediately. */
export async function discoverConsultancies(
  opts: { count?: number; activate?: boolean } = {}
): Promise<DiscoveryResult> {
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

  // Existing portals — used both to steer the prompt away from dups and to skip
  // them after (by URL or company name, case-insensitive).
  const existing = await prisma.companyPortal.findMany({ select: { careersUrl: true, company: true } });
  const seenUrls = new Set(existing.map((e) => e.careersUrl.toLowerCase()));
  const seenCompanies = new Set(existing.map((e) => e.company.toLowerCase()));

  const candidates = await proposeCandidates(client, opts.count ?? 20, existing.map((e) => e.company));
  result.proposed = candidates.length;
  if (candidates.length === 0) {
    result.error = 'no candidates proposed';
    return result;
  }

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
        titleFilters: JSON.stringify(valid.filters),
        isActive: opts.activate ?? false, // default: pending operator review
      },
    });
    // Avoid re-adding within the same run if the LLM repeats a firm.
    seenUrls.add(c.careersUrl.toLowerCase());
    seenCompanies.add(c.company.toLowerCase());
    result.added.push({ company: c.company, portalType: valid.portalType, jobs: valid.jobs });
  }

  return result;
}
