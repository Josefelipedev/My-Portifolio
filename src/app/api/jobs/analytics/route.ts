import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { error } from '@/lib/api-utils';

interface FunnelData {
  saved: number;
  applied: number;
  interview: number;
  offer: number;
  rejected: number;
}

interface WeeklyData {
  week: string;
  saved: number;
  applied: number;
}

interface SourceData {
  source: string;
  total: number;
  applied: number;
  interview: number;
  offer: number;
}

interface TopCompany {
  company: string;
  count: number;
}

interface TopTag {
  tag: string;
  count: number;
}

interface AnalyticsResponse {
  funnel: FunnelData;
  weeklyActivity: WeeklyData[];
  sourceEffectiveness: SourceData[];
  avgTimeToInterview: number | null;
  topCompanies: TopCompany[];
  topTags: TopTag[];
  staleJobsCount: number;
  totalSavedJobs: number;
  totalApplications: number;
  recentSearches: number;
}

// GET - Fetch analytics data
export async function GET() {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all applications with their status
    const applications = await prisma.jobApplication.findMany({
      select: {
        id: true,
        status: true,
        createdAt: true,
        appliedAt: true,
        savedJob: {
          select: {
            source: true,
            company: true,
          },
        },
        timeline: true,
      },
    });

    // Get saved jobs count
    const savedJobsCount = await prisma.savedJob.count();

    // Get recent searches count (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSearchesCount = await prisma.jobSearchHistory.count({
      where: {
        searchedAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    // Calculate funnel
    const funnel: FunnelData = {
      saved: savedJobsCount,
      applied: applications.filter((a) => a.status === 'applied' || a.status === 'interview' || a.status === 'offer').length,
      interview: applications.filter((a) => a.status === 'interview' || a.status === 'offer').length,
      offer: applications.filter((a) => a.status === 'offer').length,
      rejected: applications.filter((a) => a.status === 'rejected').length,
    };

    // Calculate weekly activity (last 8 weeks)
    const weeklyActivity: WeeklyData[] = [];
    const savedJobs = await prisma.savedJob.findMany({
      select: {
        savedAt: true,
      },
      where: {
        savedAt: {
          gte: new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const savedInWeek = savedJobs.filter(
        (job) => new Date(job.savedAt) >= weekStart && new Date(job.savedAt) < weekEnd
      ).length;

      const appliedInWeek = applications.filter(
        (app) => app.appliedAt && new Date(app.appliedAt) >= weekStart && new Date(app.appliedAt) < weekEnd
      ).length;

      weeklyActivity.push({
        week: weekLabel,
        saved: savedInWeek,
        applied: appliedInWeek,
      });
    }

    // Calculate source effectiveness
    const sourceMap = new Map<string, SourceData>();

    for (const app of applications) {
      const source = app.savedJob?.source || 'Unknown';

      if (!sourceMap.has(source)) {
        sourceMap.set(source, {
          source,
          total: 0,
          applied: 0,
          interview: 0,
          offer: 0,
        });
      }

      const data = sourceMap.get(source)!;
      data.total++;

      if (app.status === 'applied' || app.status === 'interview' || app.status === 'offer') {
        data.applied++;
      }
      if (app.status === 'interview' || app.status === 'offer') {
        data.interview++;
      }
      if (app.status === 'offer') {
        data.offer++;
      }
    }

    const sourceEffectiveness = Array.from(sourceMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Calculate average time to interview
    let totalDaysToInterview = 0;
    let interviewCount = 0;

    for (const app of applications) {
      if (app.timeline && app.appliedAt) {
        try {
          const timeline = JSON.parse(app.timeline) as { status: string; date: string }[];
          const interviewEntry = timeline.find((t) => t.status === 'interview');

          if (interviewEntry) {
            const appliedDate = new Date(app.appliedAt);
            const interviewDate = new Date(interviewEntry.date);
            const daysDiff = Math.floor((interviewDate.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24));

            if (daysDiff >= 0) {
              totalDaysToInterview += daysDiff;
              interviewCount++;
            }
          }
        } catch {
          // Skip invalid timeline
        }
      }
    }

    const avgTimeToInterview = interviewCount > 0
      ? Math.round(totalDaysToInterview / interviewCount)
      : null;

    // Get top companies
    const companyCount = new Map<string, number>();

    for (const app of applications) {
      const company = app.savedJob?.company || 'Unknown';
      companyCount.set(company, (companyCount.get(company) || 0) + 1);
    }

    const topCompanies = Array.from(companyCount.entries())
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get top tags from saved jobs
    const allSavedJobs = await prisma.savedJob.findMany({
      select: { tags: true, savedAt: true, application: { select: { id: true } } },
    });

    const tagCount = new Map<string, number>();
    for (const job of allSavedJobs) {
      if (!job.tags) continue;
      for (const tag of job.tags.split(',')) {
        const t = tag.trim().toLowerCase();
        if (t.length > 1) tagCount.set(t, (tagCount.get(t) || 0) + 1);
      }
    }

    const topTags = Array.from(tagCount.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // Count stale jobs (saved 30+ days ago, no application)
    const staleThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const staleJobsCount = allSavedJobs.filter(
      (j) => !j.application && new Date(j.savedAt) < staleThreshold
    ).length;

    const response: AnalyticsResponse = {
      funnel,
      weeklyActivity,
      sourceEffectiveness,
      avgTimeToInterview,
      topCompanies,
      topTags,
      staleJobsCount,
      totalSavedJobs: savedJobsCount,
      totalApplications: applications.length,
      recentSearches: recentSearchesCount,
    };

    return NextResponse.json(response);
  } catch (err) {
    return error(err);
  }
}
