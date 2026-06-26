// Jobs — company-first view. Aggregates saved jobs by company (joined with the
// tracked CompanyPortal) and lists a single company's jobs ranked by how well
// they match the resume. Backs the admin "Companies" board: browse PT companies,
// then drill into that company's openings. Reads require auth.

import { Hono } from 'hono';
import prisma from '../db';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';
import { calculateMatchPercentage } from '../lib/jobs/scoring';
import { discoverConsultancies } from '../lib/jobs/consultancy-discovery';
import type { JobListing, ResumeData } from '../lib/jobs/types';
import resumeJson from '../../data/resume.json';

const resume = resumeJson as unknown as ResumeData;
const companies = new Hono<AuthEnv>();

function matchOf(j: { title: string; description: string | null; tags: string | null }): number {
  return calculateMatchPercentage(
    { title: j.title, description: j.description || '', tags: j.tags ? j.tags.split(',') : [] } as JobListing,
    resume
  );
}

// GET /jobs/companies — one row per company (from saved jobs), with its job
// count, best resume-match %, how many are AI-graded / have a CV, and the
// tracked-portal info (type, active, last scan). Sorted best-match first.
companies.get('/jobs/companies', requireAuth, async (c) => {
  const [jobs, portals] = await Promise.all([
    prisma.savedJob.findMany({
      select: { company: true, title: true, description: true, tags: true, aiGrade: true, generatedCvAt: true },
    }),
    prisma.companyPortal.findMany({
      select: { company: true, portalType: true, isActive: true, lastScannedAt: true },
    }),
  ]);

  const portalByName = new Map(portals.map((p) => [p.company, p]));
  const byCompany = new Map<
    string,
    { company: string; count: number; topMatch: number; graded: number; withCv: number }
  >();

  for (const j of jobs) {
    const cur = byCompany.get(j.company) ?? { company: j.company, count: 0, topMatch: 0, graded: 0, withCv: 0 };
    cur.count += 1;
    const m = matchOf(j);
    if (m > cur.topMatch) cur.topMatch = m;
    if (j.aiGrade) cur.graded += 1;
    if (j.generatedCvAt) cur.withCv += 1;
    byCompany.set(j.company, cur);
  }

  const result = Array.from(byCompany.values())
    .map((row) => {
      const p = portalByName.get(row.company);
      return {
        ...row,
        portalType: p?.portalType ?? null,
        isActive: p?.isActive ?? null,
        lastScannedAt: p?.lastScannedAt ?? null,
      };
    })
    .sort((a, b) => b.topMatch - a.topMatch || b.count - a.count);

  return c.json(result);
});

// GET /jobs/companies/:company/jobs — that company's saved jobs, each with a
// computed resume-match %, ranked best-first.
companies.get('/jobs/companies/:company/jobs', requireAuth, async (c) => {
  const company = decodeURIComponent(c.req.param('company'));
  const jobs = await prisma.savedJob.findMany({
    where: { company },
    include: { application: { select: { id: true, status: true } } },
  });

  const ranked = jobs
    .map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      url: j.url,
      location: j.location,
      jobType: j.jobType,
      aiGrade: j.aiGrade,
      generatedCvAt: j.generatedCvAt,
      postedAt: j.postedAt,
      application: j.application,
      matchPercent: matchOf(j),
    }))
    .sort((a, b) => b.matchPercent - a.matchPercent);

  return c.json(ranked);
});

// POST /jobs/companies/discover — run the discovery agent: an LLM proposes PT IT
// consultancies, each is validated live against its ATS, and the survivors are
// added as ACTIVE tracked companies so the next scan saves their jobs.
companies.post('/jobs/companies/discover', requireAuth, requireCsrf, async (c) => {
  let count = 15;
  try {
    const body = (await c.req.json()) as { count?: number };
    if (typeof body.count === 'number') count = Math.min(40, Math.max(5, body.count));
  } catch {
    // no body — use default
  }

  const result = await discoverConsultancies({ count, activate: true });
  return c.json(result);
});

export default companies;
