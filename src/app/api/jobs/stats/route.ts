import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { success, error } from '@/lib/api-utils';

export async function GET() {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get counts for each status
    const [
      savedJobsCount,
      savedCount,
      appliedCount,
      interviewCount,
      offerCount,
      rejectedCount,
      recentApplications,
      upcomingSteps,
    ] = await Promise.all([
      prisma.savedJob.count(),
      prisma.jobApplication.count({ where: { status: 'saved' } }),
      prisma.jobApplication.count({ where: { status: 'applied' } }),
      prisma.jobApplication.count({ where: { status: 'interview' } }),
      prisma.jobApplication.count({ where: { status: 'offer' } }),
      prisma.jobApplication.count({ where: { status: 'rejected' } }),
      prisma.jobApplication.findMany({
        where: { appliedAt: { not: null } },
        orderBy: { appliedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          company: true,
          status: true,
          appliedAt: true,
        },
      }),
      prisma.jobApplication.findMany({
        where: {
          nextStepDate: { gte: new Date() },
        },
        orderBy: { nextStepDate: 'asc' },
        take: 5,
        select: {
          id: true,
          title: true,
          company: true,
          nextStep: true,
          nextStepDate: true,
        },
      }),
    ]);

    return success({
      savedJobs: savedJobsCount,
      applications: {
        saved: savedCount,
        applied: appliedCount,
        interview: interviewCount,
        offer: offerCount,
        rejected: rejectedCount,
        total: savedCount + appliedCount + interviewCount + offerCount + rejectedCount,
      },
      recentApplications,
      upcomingSteps,
    });
  } catch (err) {
    return error(err);
  }
}
