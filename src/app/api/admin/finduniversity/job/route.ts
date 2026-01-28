import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { validateCSRFToken } from '@/lib/csrf';

// In-memory job state (in production, use Redis or database)
interface JobState {
  id: string;
  type: 'sync' | 'refresh' | 'extract';
  status: 'running' | 'stopping' | 'completed' | 'failed' | 'cancelled';
  progress: {
    current: number;
    total: number;
    message: string;
  };
  startedAt: Date;
  stoppedAt?: Date;
  error?: string;
}

// Global job state map
const activeJobs = new Map<string, JobState>();

// Export for use in other modules
export function getActiveJob(id: string): JobState | undefined {
  return activeJobs.get(id);
}

export function setActiveJob(job: JobState): void {
  activeJobs.set(job.id, job);
}

export function updateJobProgress(id: string, current: number, total: number, message: string): void {
  const job = activeJobs.get(id);
  if (job) {
    job.progress = { current, total, message };
  }
}

export function isJobStopping(id: string): boolean {
  const job = activeJobs.get(id);
  return job?.status === 'stopping';
}

export function completeJob(id: string, status: 'completed' | 'failed' | 'cancelled', error?: string): void {
  const job = activeJobs.get(id);
  if (job) {
    job.status = status;
    job.stoppedAt = new Date();
    if (error) job.error = error;
  }
}

/**
 * GET /api/admin/finduniversity/job
 *
 * Get status of active jobs
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('id');

    if (jobId) {
      const job = activeJobs.get(jobId);
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json({ job });
    }

    // Return all active jobs
    const jobs = Array.from(activeJobs.values())
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    // Also get running syncs from database
    const runningSyncs = await prisma.findUniversitySyncLog.findMany({
      where: { status: 'running' },
      orderBy: { startedAt: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      activeJobs: jobs,
      runningSyncs,
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch job status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/finduniversity/job
 *
 * Control job execution (stop, cancel)
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await validateCSRFToken(request))) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const { action, jobId, syncId } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    switch (action) {
      case 'stop': {
        // Stop an in-memory job
        if (jobId) {
          const job = activeJobs.get(jobId);
          if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
          }

          if (job.status !== 'running') {
            return NextResponse.json({ error: 'Job is not running' }, { status: 400 });
          }

          job.status = 'stopping';
          return NextResponse.json({
            success: true,
            message: 'Stop signal sent to job',
            job,
          });
        }

        // Stop a database sync
        if (syncId) {
          const sync = await prisma.findUniversitySyncLog.findUnique({
            where: { id: syncId },
          });

          if (!sync) {
            return NextResponse.json({ error: 'Sync not found' }, { status: 404 });
          }

          if (sync.status !== 'running') {
            return NextResponse.json({ error: 'Sync is not running' }, { status: 400 });
          }

          // Update sync status to cancelled
          await prisma.findUniversitySyncLog.update({
            where: { id: syncId },
            data: {
              status: 'cancelled',
              completedAt: new Date(),
              errors: 'Cancelled by user',
            },
          });

          return NextResponse.json({
            success: true,
            message: 'Sync cancelled',
          });
        }

        return NextResponse.json({ error: 'jobId or syncId is required' }, { status: 400 });
      }

      case 'clear': {
        // Clear completed/failed jobs from memory
        const keysToDelete: string[] = [];
        activeJobs.forEach((job, key) => {
          if (job.status !== 'running' && job.status !== 'stopping') {
            keysToDelete.push(key);
          }
        });
        keysToDelete.forEach(key => activeJobs.delete(key));

        return NextResponse.json({
          success: true,
          cleared: keysToDelete.length,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error controlling job:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to control job' },
      { status: 500 }
    );
  }
}
