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
import type { JobListing } from '../lib/jobs/types';
import { sendEmail } from '../lib/email';
import { analyzeJob } from '../lib/jobs/ai-analysis';
import { generateCustomCV } from '../lib/jobs/cv-generator';

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
async function persistAndGrade(jobs: JobListing[]): Promise<{ saved: number; cvs: number }> {
  let saved = 0;
  let cvs = 0;
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
      if (AUTO_CV_GRADES.has(analysis.grade)) {
        await generateCustomCV(row.id);
        cvs++;
      }
    } catch (e) {
      console.warn('[portals:scan] grade/cv failed for', job.title, '-', e instanceof Error ? e.message : e);
    }
  }
  return { saved, cvs };
}

function digestHtml(jobsByCompany: Map<string, JobListing[]>, total: number): string {
  let shown = 0;
  const blocks: string[] = [];
  for (const [company, jobs] of jobsByCompany) {
    if (shown >= DIGEST_MAX) break;
    const items = jobs
      .slice(0, DIGEST_MAX - shown)
      .map(
        (j) =>
          `<li style="margin-bottom:8px"><a href="${j.url}" style="color:#dc2626;font-weight:600;text-decoration:none">${j.title}</a>${j.location ? ` <span style="color:#64748b">— ${j.location}</span>` : ''}</li>`
      );
    shown += items.length;
    blocks.push(
      `<h3 style="margin:16px 0 4px;color:#0f172a">${company} <span style="color:#94a3b8;font-weight:400">(${jobs.length})</span></h3><ul style="padding-left:18px;margin:0">${items.join('')}</ul>`
    );
  }
  const more = total > shown ? `<p style="color:#64748b;margin-top:16px">+${total - shown} mais em <strong>/admin/jobs</strong>.</p>` : '';
  return `<div style="font-family:system-ui,sans-serif;color:#0f172a">
    <h2 style="margin:0 0 4px">🏢 ${total} nova(s) vaga(s) IT em consultorias PT</h2>
    <p style="color:#64748b;margin:0">Varrimento de portais de carreiras</p>
    ${blocks.join('')}${more}
  </div>`;
}

function digestText(jobsByCompany: Map<string, JobListing[]>, total: number): string {
  const lines: string[] = [`${total} nova(s) vaga(s) IT em consultorias PT:\n`];
  for (const [company, jobs] of jobsByCompany) {
    lines.push(`\n${company} (${jobs.length}):`);
    for (const j of jobs.slice(0, DIGEST_MAX)) {
      lines.push(`  - ${j.title}${j.location ? ` — ${j.location}` : ''}\n    ${j.url}`);
    }
  }
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

  const { saved, cvs } = await persistAndGrade(newJobs);

  // Group for the digest (preserve scan order).
  const byCompany = new Map<string, JobListing[]>();
  for (const j of newJobs) {
    const list = byCompany.get(j.company) ?? [];
    list.push(j);
    byCompany.set(j.company, list);
  }

  let emailed = false;
  const to = process.env.CONTACT_EMAIL || process.env.SMTP_USER;
  if (to) {
    emailed = await sendEmail({
      to,
      subject: `🏢 ${newJobs.length} nova(s) vaga(s) IT — consultorias PT`,
      html: digestHtml(byCompany, newJobs.length),
      text: digestText(byCompany, newJobs.length),
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
