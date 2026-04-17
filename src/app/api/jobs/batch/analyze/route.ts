import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { analyzeJob } from '@/lib/jobs/ai-analysis';

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobIds } = await request.json();

    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return NextResponse.json({ error: 'jobIds array is required' }, { status: 400 });
    }

    if (jobIds.length > 20) {
      return NextResponse.json({ error: 'Maximum 20 jobs per batch' }, { status: 400 });
    }

    const results = await Promise.allSettled(
      jobIds.map((id: string) => analyzeJob(id))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    const errors = results
      .map((r, i) =>
        r.status === 'rejected'
          ? { jobId: jobIds[i], error: r.reason instanceof Error ? r.reason.message : 'Unknown error' }
          : null
      )
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      processed: jobIds.length,
      succeeded,
      failed,
      errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
