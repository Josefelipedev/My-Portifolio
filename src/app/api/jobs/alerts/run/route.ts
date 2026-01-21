import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { error } from '@/lib/api-utils';
import { searchJobs } from '@/lib/jobs';
import type { JobSource } from '@/lib/jobs';

// POST - Run an alert and find new matches
export async function POST(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { alertId } = body;

    if (!alertId) {
      return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 });
    }

    // Get the alert
    const alert = await prisma.jobAlert.findUnique({
      where: { id: alertId },
      include: {
        matches: {
          select: { jobId: true },
        },
      },
    });

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    // Get existing job IDs to avoid duplicates
    const existingJobIds = new Set(alert.matches.map((m) => m.jobId));

    // Parse sources
    const sources: JobSource[] = alert.sources === 'all'
      ? ['all']
      : alert.sources.split(',').map((s) => s.trim() as JobSource);

    // Run the search
    const jobs = await searchJobs(
      {
        keyword: alert.keyword,
        limit: 50,
        maxAgeDays: 7, // Only look at recent jobs
      },
      sources.length === 1 ? sources[0] : sources
    );

    // Filter out already matched jobs
    const newJobs = jobs.filter((job) => !existingJobIds.has(job.id));

    if (newJobs.length === 0) {
      // Update lastRun even if no new matches
      await prisma.jobAlert.update({
        where: { id: alertId },
        data: { lastRun: new Date() },
      });

      return NextResponse.json({
        newMatches: 0,
        message: 'No new jobs found',
      });
    }

    // Create match records for new jobs
    const matchRecords = newJobs.map((job) => ({
      alertId,
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
    }));

    // Use transaction to create matches and update lastRun
    await prisma.$transaction([
      prisma.jobAlertMatch.createMany({
        data: matchRecords,
        skipDuplicates: true,
      }),
      prisma.jobAlert.update({
        where: { id: alertId },
        data: { lastRun: new Date() },
      }),
    ]);

    return NextResponse.json({
      newMatches: newJobs.length,
      message: `Found ${newJobs.length} new job(s)`,
      jobs: newJobs.slice(0, 5), // Return first 5 for preview
    });
  } catch (err) {
    return error(err);
  }
}
