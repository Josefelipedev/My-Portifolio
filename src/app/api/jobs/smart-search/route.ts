import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { smartJobSearch, type ResumeData, type JobSource, getApiStatus } from '@/lib/job-search';
import { isAuthenticated } from '@/lib/auth';
import { error, withCacheHeaders } from '@/lib/api-utils';

// Load resume data from JSON file
async function loadResumeData(): Promise<ResumeData> {
  const resumePath = path.join(process.cwd(), 'src/data/resume.json');
  const content = await readFile(resumePath, 'utf-8');
  return JSON.parse(content) as ResumeData;
}

export async function GET(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const country = (searchParams.get('country') || 'all') as 'br' | 'pt' | 'remote' | 'all';
    // Support multiple sources (comma-separated) or single source
    const sourceParam = searchParams.get('source') || 'all';
    const source = sourceParam.includes(',')
      ? sourceParam.split(',').filter(Boolean) as JobSource[]
      : sourceParam as JobSource;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const maxAgeDays = searchParams.get('maxAgeDays') ? parseInt(searchParams.get('maxAgeDays')!) : 0;

    // Load resume data
    const resume = await loadResumeData();

    // Perform smart search based on resume with options
    const result = await smartJobSearch(resume, {
      country,
      source,
      limit,
      maxAgeDays,
    });

    const response = NextResponse.json({
      jobs: result.jobs,
      total: result.jobs.length,
      keywords: result.keywords,
      resumeName: resume.personalInfo?.name || 'Unknown',
      skillsUsed: resume.skills?.slice(0, 5).map(s => s.name) || [],
      params: { country, source, limit, maxAgeDays },
      apis: getApiStatus(),
    });

    // Cache for 5 minutes
    return withCacheHeaders(response, 300, 600);
  } catch (err) {
    return error(err);
  }
}
