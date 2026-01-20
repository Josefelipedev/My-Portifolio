import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { smartJobSearch, type ResumeData, getApiStatus } from '@/lib/job-search';
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
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;

    // Load resume data
    const resume = await loadResumeData();

    // Perform smart search based on resume
    const result = await smartJobSearch(resume, country, limit);

    const response = NextResponse.json({
      jobs: result.jobs,
      total: result.jobs.length,
      keywords: result.keywords,
      resumeName: resume.personalInfo?.name || 'Unknown',
      skillsUsed: resume.skills?.slice(0, 5).map(s => s.name) || [],
      apis: getApiStatus(),
    });

    // Cache for 5 minutes
    return withCacheHeaders(response, 300, 600);
  } catch (err) {
    return error(err);
  }
}
