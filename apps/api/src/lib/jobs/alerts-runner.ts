// Alert runner — executes due job alerts: runs each alert's saved search,
// records new matches (deduped via JobAlertMatch), emails a digest, and
// reschedules. Driven by src/scripts/run-alerts.ts (VPS cron) and the
// authenticated POST /api/jobs/alerts/run endpoint ("Run now").

import prisma from '../../db';
import { searchJobs } from './aggregator';
import type { JobSource, JobListing } from './types';
import { sendEmail } from '../email';
import { analyzeJob } from './ai-analysis';
import { generateCustomCV } from './cv-generator';

// Auto-CV: when an alert finds new jobs, save them, AI-grade them, and
// pre-generate the tailored CV for the strong matches. Bounded per run.
const AUTO_CV_ENABLED = process.env.AUTO_CV_ENABLED !== 'false';
const AUTO_CV_PER_RUN = parseInt(process.env.AUTO_CV_PER_RUN || '5', 10);
const AUTO_CV_GRADES = new Set(['A', 'B']);

/** Next scheduled run from comma-separated hours (0-23) and days (0-6, 0=Sun).
 *  Returns null when scheduling can't be resolved (disables auto-run). */
export function calculateNextRun(scheduleHours: string, scheduleDays: string): Date | null {
  if (!scheduleHours) return null;

  const hours = scheduleHours
    .split(',')
    .map((h) => parseInt(h.trim(), 10))
    .filter((h) => !isNaN(h) && h >= 0 && h <= 23);
  const days = scheduleDays
    ? scheduleDays
        .split(',')
        .map((d) => parseInt(d.trim(), 10))
        .filter((d) => !isNaN(d) && d >= 0 && d <= 6)
    : [0, 1, 2, 3, 4, 5, 6];

  if (hours.length === 0) return null;

  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay();

  const nextHourToday = hours.find((h) => h > currentHour);
  if (nextHourToday !== undefined && days.includes(currentDay)) {
    const next = new Date(now);
    next.setHours(nextHourToday, 0, 0, 0);
    return next;
  }

  for (let i = 1; i <= 7; i++) {
    const checkDay = (currentDay + i) % 7;
    if (days.includes(checkDay)) {
      const next = new Date(now);
      next.setDate(now.getDate() + i);
      next.setHours(hours[0], 0, 0, 0);
      return next;
    }
  }

  return null;
}

export interface AlertRunResult {
  alertId: string;
  name: string;
  found: number;
  newMatches: number;
  emailed: boolean;
  cvsGenerated: number;
  error?: string;
}

// Structural subset of prisma JobAlert used by the runner.
interface AlertRow {
  id: string;
  name: string;
  keyword: string;
  countries: string;
  sources: string;
  scheduleHours: string | null;
  scheduleDays: string | null;
  emailOnMatch: boolean;
}

type MatchedJob = { title: string; company: string; url: string; location?: string };

function digestText(alert: AlertRow, jobs: MatchedJob[]): string {
  const lines = jobs.map(
    (j) => `- ${j.title} — ${j.company}${j.location ? ` (${j.location})` : ''}\n  ${j.url}`
  );
  return `${jobs.length} nova(s) vaga(s) para o alerta "${alert.name}" (${alert.keyword}):\n\n${lines.join('\n\n')}`;
}

function digestHtml(alert: AlertRow, jobs: MatchedJob[]): string {
  const items = jobs
    .map(
      (j) =>
        `<li style="margin-bottom:10px"><a href="${j.url}" style="color:#dc2626;font-weight:600;text-decoration:none">${j.title}</a> — ${j.company}${j.location ? ` <span style="color:#64748b">(${j.location})</span>` : ''}</li>`
    )
    .join('');
  return `<div style="font-family:system-ui,sans-serif;color:#0f172a">
    <h2 style="margin:0 0 4px">🔔 ${jobs.length} nova(s) vaga(s)</h2>
    <p style="color:#64748b;margin:0 0 16px">Alerta <strong>${alert.name}</strong> · "${alert.keyword}"</p>
    <ul style="padding-left:18px">${items}</ul>
  </div>`;
}

// Save a found job (if not already saved) so it can be graded and get a CV.
async function upsertSavedJob(listing: JobListing): Promise<{ id: string; generatedCvAt: Date | null }> {
  const existing = await prisma.savedJob.findUnique({
    where: { externalId: listing.id },
    select: { id: true, generatedCvAt: true },
  });
  if (existing) return existing;
  return prisma.savedJob.create({
    data: {
      externalId: listing.id,
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

// For new jobs: save, AI-grade, and pre-generate the tailored CV for A/B matches.
// Bounded by a shared per-run budget; skips jobs that already have a CV.
async function autoGenerateCvs(listings: JobListing[], budget: { remaining: number }): Promise<number> {
  if (!AUTO_CV_ENABLED) return 0;
  let generated = 0;
  for (const listing of listings) {
    if (budget.remaining <= 0) break;
    let saved: { id: string; generatedCvAt: Date | null };
    try {
      saved = await upsertSavedJob(listing);
    } catch {
      continue;
    }
    if (saved.generatedCvAt) continue; // already has a tailored CV
    budget.remaining -= 1;
    try {
      const analysis = await analyzeJob(saved.id);
      if (AUTO_CV_GRADES.has(analysis.grade)) {
        await generateCustomCV(saved.id);
        generated += 1;
      }
    } catch (e) {
      console.warn('[auto-cv] failed for', listing.title, '-', e instanceof Error ? e.message : e);
    }
  }
  return generated;
}

/** Run a single alert: search, dedupe, record matches, email, reschedule, and
 *  (within the shared budget) pre-generate CVs for strong new matches. */
export async function runAlert(
  alert: AlertRow,
  budget: { remaining: number } = { remaining: AUTO_CV_PER_RUN }
): Promise<AlertRunResult> {
  try {
    const source: JobSource | JobSource[] =
      alert.sources && alert.sources !== 'all'
        ? (alert.sources.split(',').map((s) => s.trim()).filter(Boolean) as JobSource[])
        : 'all';

    const listings = await searchJobs(
      { keyword: alert.keyword, country: alert.countries || 'all', limit: 50 },
      source
    );

    let newMatches: typeof listings = [];
    if (listings.length) {
      const existing = await prisma.jobAlertMatch.findMany({
        where: { alertId: alert.id, jobId: { in: listings.map((l) => l.id) } },
        select: { jobId: true },
      });
      const seen = new Set(existing.map((e) => e.jobId));
      newMatches = listings.filter((l) => !seen.has(l.id));
      if (newMatches.length) {
        await prisma.jobAlertMatch.createMany({
          data: newMatches.map((l) => ({
            alertId: alert.id,
            jobId: l.id,
            jobTitle: l.title,
            company: l.company,
          })),
          skipDuplicates: true,
        });
      }
    }

    let emailed = false;
    if (newMatches.length && alert.emailOnMatch) {
      const to = process.env.CONTACT_EMAIL || process.env.SMTP_USER;
      if (to) {
        emailed = await sendEmail({
          to,
          subject: `🔔 ${newMatches.length} nova(s) vaga(s) — ${alert.name}`,
          html: digestHtml(alert, newMatches),
          text: digestText(alert, newMatches),
        });
        if (emailed) {
          await prisma.jobAlertMatch.updateMany({
            where: { alertId: alert.id, jobId: { in: newMatches.map((l) => l.id) } },
            data: { notified: true },
          });
        }
      }
    }

    const cvsGenerated = await autoGenerateCvs(newMatches, budget);

    await prisma.jobAlert.update({
      where: { id: alert.id },
      data: {
        lastRun: new Date(),
        nextRun: calculateNextRun(alert.scheduleHours || '', alert.scheduleDays || ''),
      },
    });

    return {
      alertId: alert.id,
      name: alert.name,
      found: listings.length,
      newMatches: newMatches.length,
      emailed,
      cvsGenerated,
    };
  } catch (error) {
    return {
      alertId: alert.id,
      name: alert.name,
      found: 0,
      newMatches: 0,
      emailed: false,
      cvsGenerated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/** Run all alerts that are due (or every active alert when force=true). */
export async function runDueAlerts(opts: { force?: boolean } = {}): Promise<AlertRunResult[]> {
  const now = new Date();
  const alerts = await prisma.jobAlert.findMany({
    where: opts.force
      ? { isActive: true }
      : { isActive: true, scheduleEnabled: true, OR: [{ nextRun: null }, { nextRun: { lte: now } }] },
    orderBy: { createdAt: 'asc' },
  });

  // Shared auto-CV budget across all alerts in this run (caps paid AI calls).
  const budget = { remaining: AUTO_CV_PER_RUN };
  const results: AlertRunResult[] = [];
  for (const alert of alerts) {
    results.push(await runAlert(alert, budget));
  }
  return results;
}
