import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { generateCustomCV } from '@/lib/jobs/cv-generator';

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

    if (jobIds.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 jobs per batch CV generation' }, { status: 400 });
    }

    const results = await Promise.allSettled(
      jobIds.map((id: string) => generateCustomCV(id))
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

    // Return CV content for client-side PDF generation
    const cvData = results.map((r, i) => ({
      jobId: jobIds[i],
      success: r.status === 'fulfilled',
      customCV: r.status === 'fulfilled' ? r.value : null,
      error: r.status === 'rejected' ? (r.reason instanceof Error ? r.reason.message : 'Unknown') : null,
    }));

    return NextResponse.json({
      success: true,
      processed: jobIds.length,
      succeeded,
      failed,
      errors,
      cvData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
