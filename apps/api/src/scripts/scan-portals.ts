// Scans every active company portal (PT IT consultancies seeded via
// seed-consultancies.ts), persists newly-found IT jobs as SavedJob rows so they
// surface in /admin/jobs, AI-grades a bounded number of them, pre-generates a
// tailored CV for the strong (A/B) matches, and emails a digest grouped by
// company.
//
// Driven by the VPS cron (e.g. a few times a day), alongside run-alerts.
// Run: npm run portals:scan
//
// The portal scanner records every reported job in PortalSeenJob, so each run
// only yields the delta since the last scan. The very first scan of a portal
// reports its whole board as "new" once (baseline) — hence the digest cap below.

import prisma from '../db';
import { scanAllPortals, type PortalScanResult } from '../lib/jobs/portal-scanner';
import type { JobListing, ResumeData } from '../lib/jobs/types';
import { scoreJobs, calculateMatchPercentage } from '../lib/jobs/scoring';
import { sendEmail } from '../lib/email';
import { analyzeJob } from '../lib/jobs/ai-analysis';
import { generateCustomCV } from '../lib/jobs/cv-generator';
import resumeJson from '../../data/resume.json';

const resume = resumeJson as unknown as ResumeData;

const AUTO_CV_ENABLED = process.env.AUTO_CV_ENABLED !== 'false';
// Caps paid AI calls (grading) per run, shared across all portals.
const PORTAL_CV_PER_RUN = parseInt(process.env.PORTAL_CV_PER_RUN || '5', 10);
const AUTO_CV_GRADES = new Set(['A', 'B']);
// Max jobs listed in the digest email (the rest are in /admin/jobs).
const DIGEST_MAX = parseInt(process.env.PORTAL_DIGEST_MAX || '30', 10);

// Save a portal job keyed by URL (ATS native ids can collide across companies,
// URLs cannot). Returns the row id + whether it already has a tailored CV.
async function saveJob(listing: JobListing): Promise<{ id: string; generatedCvAt: Date | null }> {
  const existing = await prisma.savedJob.findUnique({
    where: { externalId: listing.url },
    select: { id: true, generatedCvAt: true },
  });
  if (existing) return existing;
  return prisma.savedJob.create({
    data: {
      externalId: listing.url,
      source: listing.source,
      title: listing.title,
      company: listing.company,
      companyLogo: listing.companyLogo ?? undefined,
      description: listing.description || '',
      url: listing.url,
      location: listing.location ?? undefined,
      jobType: listing.jobType ?? undefined,
      salary: listing.salary ?? undefined,
      tags: listing.tags?.length ? listing.tags.join(',') : null,
      postedAt: listing.postedAt ?? null,
    },
    select: { id: true, generatedCvAt: true },
  });
}

// Save all, then AI-grade + pre-generate CVs for A/B matches within the budget.
// `jobs` must already be ranked best-first so the limited AI budget is spent on
// the strongest profile matches. Returns the AI grade per job url (for the email).
async function persistAndGrade(
  jobs: JobListing[]
): Promise<{ saved: number; cvs: number; grades: Map<string, string> }> {
  let saved = 0;
  let cvs = 0;
  const grades = new Map<string, string>();
  const budget = { remaining: PORTAL_CV_PER_RUN };

  for (const job of jobs) {
    let row: { id: string; generatedCvAt: Date | null };
    try {
      row = await saveJob(job);
      saved++;
    } catch {
      continue;
    }
    if (!AUTO_CV_ENABLED || budget.remaining <= 0 || row.generatedCvAt) continue;
    budget.remaining -= 1;
    try {
      const analysis = await analyzeJob(row.id);
      grades.set(job.url, analysis.grade);
      if (AUTO_CV_GRADES.has(analysis.grade)) {
        await generateCustomCV(row.id);
        cvs++;
      }
    } catch (e) {
      console.warn('[portals:scan] grade/cv failed for', job.title, '-', e instanceof Error ? e.message : e);
    }
  }
  return { saved, cvs, grades };
}

// A digest row: the job plus its resume-match % and (if graded) AI grade.
interface DigestRow {
  job: JobListing;
  pct: number;
  grade?: string;
}

const GRADE_COLOR: Record<string, string> = {
  A: '#16a34a', B: '#65a30d', C: '#ca8a04', D: '#ea580c', F: '#dc2626',
};

function pctColor(pct: number): string {
  return pct >= 60 ? '#16a34a' : pct >= 35 ? '#ca8a04' : '#94a3b8';
}

function digestHtml(rows: DigestRow[], total: number): string {
  const items = rows
    .slice(0, DIGEST_MAX)
    .map(({ job, pct, grade }) => {
      const gradeBadge = grade
        ? ` <span style="background:${GRADE_COLOR[grade] || '#64748b'};color:#fff;border-radius:4px;padding:1px 6px;font-size:12px;font-weight:700">${grade}</span>`
        : '';
      const pctBadge = `<span style="color:${pctColor(pct)};font-weight:700">${pct}%</span>`;
      return `<li style="margin-bottom:10px">
        ${pctBadge}${gradeBadge}
        <a href="${job.url}" style="color:#dc2626;font-weight:600;text-decoration:none">${job.title}</a>
        <span style="color:#64748b">— ${job.company}${job.location ? ` · ${job.location}` : ''}</span>
      </li>`;
    })
    .join('');
  const more = total > DIGEST_MAX ? `<p style="color:#64748b;margin-top:16px">+${total - DIGEST_MAX} mais em <strong>/admin/jobs</strong>.</p>` : '';
  return `<div style="font-family:system-ui,sans-serif;color:#0f172a">
    <h2 style="margin:0 0 4px">🎯 ${total} nova(s) vaga(s) IT — melhores matches para o teu perfil</h2>
    <p style="color:#64748b;margin:0 0 12px">Ordenadas por afinidade ao teu CV · <strong>%</strong> = match de skills · letra = nota IA</p>
    <ul style="padding-left:18px;margin:0;list-style:none">${items}</ul>${more}
  </div>`;
}

function digestText(rows: DigestRow[], total: number): string {
  const lines: string[] = [`${total} nova(s) vaga(s) IT — melhores matches para o teu perfil:\n`];
  for (const { job, pct, grade } of rows.slice(0, DIGEST_MAX)) {
    lines.push(`  [${pct}%${grade ? ` ${grade}` : ''}] ${job.title} — ${job.company}${job.location ? ` · ${job.location}` : ''}\n    ${job.url}`);
  }
  if (total > DIGEST_MAX) lines.push(`\n+${total - DIGEST_MAX} mais em /admin/jobs.`);
  return lines.join('\n');
}

(async () => {
  const started = Date.now();
  const results: PortalScanResult[] = await scanAllPortals();

  const newJobs = results.flatMap((r) => r.newJobs);
  const errors = results.flatMap((r) => r.errors.map((e) => `${r.company}: ${e}`));

  console.log(
    `[portals:scan] scanned ${results.length} portal(s), ${newJobs.length} new IT job(s) in ${Date.now() - started}ms`
  );
  for (const r of results) {
    console.log(`  - ${r.company} [${r.portalType}]: found ${r.totalFound}, new ${r.newJobs.length}` + (r.errors.length ? `, errors: ${r.errors.join('; ')}` : ''));
  }

  if (newJobs.length === 0) {
    if (errors.length) console.warn('[portals:scan] errors:', errors.join(' | '));
    process.exit(0);
  }

  // Rank by fit to the resume (best first): primary key is the skill-match % to
  // the CV, tie-broken by the richer relevance score (freshness/completeness).
  // This way the limited AI budget grades the strongest matches and the email
  // leads with the most relevant jobs.
  const scored = scoreJobs(newJobs, resume); // sets relevanceScore
  const rows: DigestRow[] = scored
    .map((job) => ({ job, pct: calculateMatchPercentage(job, resume), grade: undefined as string | undefined }))
    .sort((a, b) => b.pct - a.pct || (b.job.relevanceScore || 0) - (a.job.relevanceScore || 0));

  const { saved, cvs, grades } = await persistAndGrade(rows.map((r) => r.job));
  for (const r of rows) r.grade = grades.get(r.job.url);

  let emailed = false;
  const to = process.env.CONTACT_EMAIL || process.env.SMTP_USER;
  if (to) {
    emailed = await sendEmail({
      to,
      subject: `🎯 ${newJobs.length} nova(s) vaga(s) IT — melhores matches para ti`,
      html: digestHtml(rows, newJobs.length),
      text: digestText(rows, newJobs.length),
    });
  }

  console.log(
    `[portals:scan] saved ${saved}, CVs ${cvs}, emailed ${emailed}` + (errors.length ? `, ${errors.length} error(s)` : '')
  );
  process.exit(0);
})().catch((e) => {
  console.error('[portals:scan] runner failed:', e);
  process.exit(1);
});
