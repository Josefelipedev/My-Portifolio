import { NextResponse } from 'next/server';
import {
  searchJobs,
  getApiStatus,
  type JobSource,
  type JobSearchParams,
} from '@/lib/job-search';
import { isAuthenticated } from '@/lib/auth';
import { error, withCacheHeaders } from '@/lib/api-utils';

export async function GET(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || undefined;
    // Support multiple sources (comma-separated) or single source
    const sourceParam = searchParams.get('source') || 'all';
    const source = sourceParam.includes(',')
      ? sourceParam.split(',').filter(Boolean) as JobSource[]
      : sourceParam as JobSource;
    // Support multiple countries (comma-separated) or single country
    const country = searchParams.get('country') || 'all';
    const location = searchParams.get('location') || undefined;
    const category = searchParams.get('category') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const maxAgeDays = searchParams.get('maxAgeDays') ? parseInt(searchParams.get('maxAgeDays')!) : 0;

    // Check for API status endpoint
    if (searchParams.get('status') === 'true') {
      return NextResponse.json({
        apis: getApiStatus(),
      });
    }

    // Use general search which now handles multiple countries
    const params: JobSearchParams = { keyword, location, category, limit, country, maxAgeDays };
    const jobs = await searchJobs(params, source);

    const response = NextResponse.json({
      jobs,
      total: jobs.length,
      params: { keyword, source, country, location, category, limit, maxAgeDays },
      apis: getApiStatus(),
    });

    // Cache for 5 minutes
    return withCacheHeaders(response, 300, 600);
  } catch (err) {
    return error(err);
  }
}
