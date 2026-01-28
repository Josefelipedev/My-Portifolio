import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

const SCRAPER_URL = process.env.PYTHON_SCRAPER_URL || 'http://localhost:8000';

/**
 * GET /api/admin/finduniversity/config
 *
 * Get current scraper configuration including source URLs.
 * Proxies to: SCRAPER_URL/config
 */
export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${SCRAPER_URL}/config`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch scraper config' },
        { status: response.status }
      );
    }

    const config = await response.json();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error fetching scraper config:', error);

    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Scraper not available (timeout)' }, { status: 504 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch config' },
      { status: 500 }
    );
  }
}
