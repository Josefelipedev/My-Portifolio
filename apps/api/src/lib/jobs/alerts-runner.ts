// Alert runner — executes due job alerts: runs each alert's saved search,
// records new matches (deduped via JobAlertMatch), emails a digest, and
// reschedules. Driven by src/scripts/run-alerts.ts (VPS cron) and the
// authenticated POST /api/jobs/alerts/run endpoint ("Run now").

import prisma from '../../db';
import { searchJobs } from './aggregator';
import type { JobSource } from './types';
import { sendEmail } from '../email';

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

/** Run a single alert: search, dedupe, record matches, email, reschedule. */
export async function runAlert(alert: AlertRow): Promise<AlertRunResult> {
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
    };
  } catch (error) {
    return {
      alertId: alert.id,
      name: alert.name,
      found: 0,
      newMatches: 0,
      emailed: false,
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

  const results: AlertRunResult[] = [];
  for (const alert of alerts) {
    results.push(await runAlert(alert));
  }
  return results;
}
