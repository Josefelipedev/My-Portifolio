import { NextResponse } from 'next/server';

const SCRAPER_URL = process.env.PYTHON_SCRAPER_URL || 'http://localhost:8000';

/**
 * GET /api/admin/finduniversity/health
 *
 * Check if the Python scraper service is online.
 * Returns { online: true/false, message: string }
 */
export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${SCRAPER_URL}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        online: true,
        message: 'Scraper service is online',
        data,
      });
    } else {
      return NextResponse.json({
        online: false,
        message: `Scraper returned status ${response.status}`,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('abort')) {
      return NextResponse.json({
        online: false,
        message: 'Scraper service timed out (not responding)',
      });
    }

    return NextResponse.json({
      online: false,
      message: `Scraper service is not available: ${errorMessage}`,
    });
  }
}
