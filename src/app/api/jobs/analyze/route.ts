import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { analyzeJob } from '@/lib/jobs/ai-analysis';

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await request.json();
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const analyzedAt = new Date().toISOString();
    const analysis = await analyzeJob(jobId);

    return NextResponse.json({ success: true, analysis, analyzedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('quota') ? 429
      : message.includes('not found') ? 404
      : message.includes('not configured') ? 503
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
