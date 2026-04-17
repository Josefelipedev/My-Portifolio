import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { scanAllPortals } from '@/lib/jobs/portal-scanner';

export async function POST() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const results = await scanAllPortals();

    const totalNew = results.reduce((sum, r) => sum + r.newJobs.length, 0);
    const totalFound = results.reduce((sum, r) => sum + r.totalFound, 0);
    const errors = results.flatMap((r) => r.errors.map((e) => `${r.company}: ${e}`));

    return NextResponse.json({
      success: true,
      summary: {
        companiesScanned: results.length,
        totalJobsFound: totalFound,
        newJobsFound: totalNew,
        errors,
      },
      results: results.map((r) => ({
        company: r.company,
        portalType: r.portalType,
        totalFound: r.totalFound,
        newJobs: r.newJobs.length,
        jobTitles: r.newJobs.slice(0, 5).map((j) => j.title),
        errors: r.errors,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
