import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getWakaTimeStats } from '@/lib/wakatime';

// GET - Fetch WakaTime preview data (admin only)
export async function GET() {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getWakaTimeStats();

    if (!stats) {
      return NextResponse.json({ error: 'Failed to fetch WakaTime data' }, { status: 500 });
    }

    return NextResponse.json({
      totalHours: stats.totalHours,
      dailyAverage: stats.dailyAverage,
      bestDay: stats.bestDay,
      languages: stats.languages,
      projects: stats.projects,
    });
  } catch (error) {
    console.error('WakaTime preview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
