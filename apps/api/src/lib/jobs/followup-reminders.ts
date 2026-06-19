// Follow-up reminders — emails a daily digest of job applications whose next
// step is due today or overdue. Driven by src/scripts/run-followups.ts (VPS
// cron, once a day). Rejected applications are skipped.

import prisma from '../../db';
import { sendEmail } from '../email';

export interface FollowupResult {
  count: number;
  emailed: boolean;
}

function fmt(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export async function sendFollowupReminders(): Promise<FollowupResult> {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const apps = await prisma.jobApplication.findMany({
    where: {
      nextStepDate: { not: null, lte: endOfToday },
      status: { notIn: ['rejected'] },
    },
    orderBy: { nextStepDate: 'asc' },
    select: {
      title: true,
      company: true,
      url: true,
      status: true,
      nextStep: true,
      nextStepDate: true,
    },
  });

  if (apps.length === 0) return { count: 0, emailed: false };

  const to = process.env.CONTACT_EMAIL || process.env.SMTP_USER;
  if (!to) return { count: apps.length, emailed: false };

  const rows = apps.map((a) => {
    const date = a.nextStepDate as Date;
    const overdue = date < startOfToday;
    return { ...a, overdue, dateLabel: fmt(date) };
  });

  const textLines = rows.map(
    (r) =>
      `${r.overdue ? '⚠ ATRASADO' : '📅 hoje'} (${r.dateLabel}) — ${r.nextStep || 'Follow-up'}: ${r.title} @ ${r.company} [${r.status}]`
  );
  const text = `${apps.length} follow-up(s) de candidatura para hoje:\n\n${textLines.join('\n')}`;

  const htmlItems = rows
    .map(
      (r) =>
        `<li style="margin-bottom:8px">
          <span style="font-weight:600;color:${r.overdue ? '#dc2626' : '#ca8a04'}">${r.overdue ? '⚠ Atrasado' : '📅 Hoje'} · ${r.dateLabel}</span>
          — ${r.nextStep || 'Follow-up'}: ${r.url ? `<a href="${r.url}" style="color:#dc2626;text-decoration:none">${r.title}</a>` : `<strong>${r.title}</strong>`} @ ${r.company}
          <span style="color:#94a3b8">(${r.status})</span>
        </li>`
    )
    .join('');
  const html = `<div style="font-family:system-ui,sans-serif;color:#0f172a">
    <h2 style="margin:0 0 12px">📋 ${apps.length} follow-up(s) para hoje</h2>
    <ul style="padding-left:18px">${htmlItems}</ul>
  </div>`;

  const emailed = await sendEmail({
    to,
    subject: `📋 ${apps.length} follow-up(s) de candidatura para hoje`,
    html,
    text,
  });

  return { count: apps.length, emailed };
}
