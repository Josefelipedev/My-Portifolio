import { NextResponse } from 'next/server';
import {
  searchJobs,
  searchJobsByCountry,
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
    const source = (searchParams.get('source') || 'all') as JobSource;
    const country = searchParams.get('country') || undefined; // 'br' | 'pt' | 'remote' | 'all'
    const location = searchParams.get('location') || undefined;
    const category = searchParams.get('category') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;

    // Check for API status endpoint
    if (searchParams.get('status') === 'true') {
      return NextResponse.json({
        apis: getApiStatus(),
      });
    }

    let jobs;

    // If country is specified, use country-specific search
    if (country && country !== 'all') {
      jobs = await searchJobsByCountry(
        keyword || 'developer',
        country as 'br' | 'pt' | 'remote',
        limit
      );
    } else {
      // Use general search with source filter
      const params: JobSearchParams = { keyword, location, category, limit, country };
      jobs = await searchJobs(params, source);
    }

    const response = NextResponse.json({
      jobs,
      total: jobs.length,
      params: { keyword, source, country, location, category, limit },
      apis: getApiStatus(),
    });

    // Cache for 5 minutes
    return withCacheHeaders(response, 300, 600);
  } catch (err) {
    return error(err);
  }
}
