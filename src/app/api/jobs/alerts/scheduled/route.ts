import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email';

const CRON_SECRET = process.env.CRON_SECRET;
const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// Calculate the next run time based on schedule settings
function calculateNextRun(scheduleHours: string, scheduleDays: string | null): Date | null {
  if (!scheduleHours) return null;

  const hours = scheduleHours.split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h) && h >= 0 && h <= 23);
  const days = scheduleDays ? scheduleDays.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d) && d >= 0 && d <= 6) : [0, 1, 2, 3, 4, 5, 6];

  if (hours.length === 0) return null;

  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay();

  // Find the next valid hour today
  const nextHourToday = hours.find(h => h > currentHour);
  if (nextHourToday !== undefined && days.includes(currentDay)) {
    const next = new Date(now);
    next.setHours(nextHourToday, 0, 0, 0);
    return next;
  }

  // Find the next valid day
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

// Search for jobs using the main search API
async function searchJobs(keyword: string, country: string, source: string) {
  try {
    const params = new URLSearchParams({
      keyword,
      country,
      source,
      pageSize: '50',
      maxAgeDays: '1', // Only get jobs from last 24h
    });

    const response = await fetch(`${API_BASE_URL}/api/jobs/search?${params}`);
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data = await response.json();
    return data.jobs || [];
  } catch (error) {
    logger.error('job-alerts', `Job search failed for "${keyword}"`, { error: String(error) });
    return [];
  }
}

// POST - Run scheduled alerts (called by cron)
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret if set
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Find all alerts that are due to run
    const dueAlerts = await prisma.jobAlert.findMany({
      where: {
        isActive: true,
        scheduleEnabled: true,
        nextRun: {
          lte: now,
        },
      },
    });

    if (dueAlerts.length === 0) {
      return NextResponse.json({ message: 'No alerts due to run', ran: 0 });
    }

    logger.info('job-alerts', `Running ${dueAlerts.length} scheduled alerts`);

    const results = [];

    for (const alert of dueAlerts) {
      try {
        // Search for jobs
        const jobs = await searchJobs(alert.keyword, alert.countries, alert.sources);

        // Find new jobs (not already matched)
        const existingMatches = await prisma.jobAlertMatch.findMany({
          where: { alertId: alert.id },
          select: { jobId: true },
        });
        const existingJobIds = new Set(existingMatches.map(m => m.jobId));

        const newJobs = jobs.filter((job: { id: string }) => !existingJobIds.has(job.id));

        // Create matches for new jobs
        if (newJobs.length > 0) {
          await prisma.jobAlertMatch.createMany({
            data: newJobs.map((job: { id: string; title: string; company: string }) => ({
              alertId: alert.id,
              jobId: job.id,
              jobTitle: job.title,
              company: job.company,
            })),
            skipDuplicates: true,
          });

          // Send email notification if enabled
          if (alert.emailOnMatch) {
            const alertEmail = process.env.ALERT_EMAIL || process.env.CONTACT_EMAIL || process.env.SMTP_USER;
            if (alertEmail) {
              const jobList = newJobs.slice(0, 10).map((job: { title: string; company: string; url?: string }) =>
                `- ${job.title} at ${job.company}${job.url ? ` (${job.url})` : ''}`
              ).join('\n');

              await sendEmail({
                to: alertEmail,
                subject: `Job Alert: ${newJobs.length} new jobs for "${alert.name}"`,
                text: `Your job alert "${alert.name}" found ${newJobs.length} new jobs matching "${alert.keyword}".\n\nTop matches:\n${jobList}\n\nView all jobs at: ${API_BASE_URL}/admin/jobs`,
                html: `
                  <h2>Job Alert: ${alert.name}</h2>
                  <p>Found <strong>${newJobs.length}</strong> new jobs matching "<strong>${alert.keyword}</strong>".</p>
                  <h3>Top matches:</h3>
                  <ul>
                    ${newJobs.slice(0, 10).map((job: { title: string; company: string; url?: string }) =>
                      `<li><strong>${job.title}</strong> at ${job.company}${job.url ? ` - <a href="${job.url}">View Job</a>` : ''}</li>`
                    ).join('')}
                  </ul>
                  <p><a href="${API_BASE_URL}/admin/jobs">View all jobs in dashboard</a></p>
                `,
              });
            }
          }

          logger.info('job-alerts', `Alert "${alert.name}" found ${newJobs.length} new jobs`);
        }

        // Update lastRun and calculate nextRun
        const nextRun = calculateNextRun(alert.scheduleHours || '', alert.scheduleDays);
        await prisma.jobAlert.update({
          where: { id: alert.id },
          data: {
            lastRun: now,
            nextRun,
          },
        });

        results.push({
          alertId: alert.id,
          name: alert.name,
          jobsFound: jobs.length,
          newMatches: newJobs.length,
          nextRun,
        });
      } catch (error) {
        logger.error('job-alerts', `Failed to run alert "${alert.name}"`, { error: String(error) });
        results.push({
          alertId: alert.id,
          name: alert.name,
          error: String(error),
        });
      }
    }

    return NextResponse.json({
      message: `Ran ${dueAlerts.length} alerts`,
      ran: dueAlerts.length,
      results,
    });
  } catch (error) {
    logger.error('job-alerts', 'Scheduled alerts failed', { error: String(error) });
    return NextResponse.json(
      { error: 'Failed to run scheduled alerts' },
      { status: 500 }
    );
  }
}

// GET - Check scheduled alerts status
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if set
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Get stats about scheduled alerts
    const [total, enabled, due] = await Promise.all([
      prisma.jobAlert.count(),
      prisma.jobAlert.count({ where: { scheduleEnabled: true, isActive: true } }),
      prisma.jobAlert.count({
        where: {
          isActive: true,
          scheduleEnabled: true,
          nextRun: { lte: now },
        },
      }),
    ]);

    const nextAlerts = await prisma.jobAlert.findMany({
      where: {
        isActive: true,
        scheduleEnabled: true,
        nextRun: { not: null },
      },
      orderBy: { nextRun: 'asc' },
      take: 5,
      select: {
        id: true,
        name: true,
        nextRun: true,
        lastRun: true,
      },
    });

    return NextResponse.json({
      total,
      enabled,
      due,
      nextAlerts,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get scheduled alerts status' },
      { status: 500 }
    );
  }
}
