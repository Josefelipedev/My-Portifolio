import { NextResponse } from 'next/server';
import { searchAllJobs, searchRemoteOK, searchRemotive, type JobSearchParams } from '@/lib/job-search';
import { isAuthenticated } from '@/lib/auth';
import { error, withCacheHeaders } from '@/lib/api-utils';

export async function GET(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || undefined;
    const source = searchParams.get('source'); // 'remoteok' | 'remotive' | 'all'
    const category = searchParams.get('category') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;

    const params: JobSearchParams = { keyword, category, limit };

    let jobs;
    if (source === 'remoteok') {
      jobs = await searchRemoteOK(params);
    } else if (source === 'remotive') {
      jobs = await searchRemotive(params);
    } else {
      jobs = await searchAllJobs(params);
    }

    const response = NextResponse.json({
      jobs,
      total: jobs.length,
      params: { keyword, source, category, limit },
    });

    // Cache for 5 minutes
    return withCacheHeaders(response, 300, 600);
  } catch (err) {
    return error(err);
  }
}
