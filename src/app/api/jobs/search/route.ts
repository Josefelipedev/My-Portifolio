import { NextResponse } from 'next/server';
import {
  searchJobs,
  getApiStatus,
  type JobSource,
  type JobSearchParams,
} from '@/lib/jobs';
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
    const maxAgeDays = searchParams.get('maxAgeDays') ? parseInt(searchParams.get('maxAgeDays')!) : 0;

    // Pagination parameters
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 25;
    // For backwards compatibility, support 'limit' as well
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    // Check for API status endpoint
    if (searchParams.get('status') === 'true') {
      return NextResponse.json({
        apis: getApiStatus(),
      });
    }

    // Fetch more jobs to allow pagination (up to 200)
    const fetchLimit = limit || 200;
    const params: JobSearchParams = { keyword, location, category, limit: fetchLimit, country, maxAgeDays };
    const allJobs = await searchJobs(params, source);

    // Calculate pagination
    const total = allJobs.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedJobs = limit ? allJobs.slice(0, limit) : allJobs.slice(startIndex, endIndex);
    const hasMore = endIndex < total;
    const totalPages = Math.ceil(total / pageSize);

    const response = NextResponse.json({
      jobs: paginatedJobs,
      total,
      page,
      pageSize,
      totalPages,
      hasMore,
      params: { keyword, source, country, location, category, maxAgeDays, page, pageSize },
      apis: getApiStatus(),
    });

    // Cache for 5 minutes
    return withCacheHeaders(response, 300, 600);
  } catch (err) {
    return error(err);
  }
}
