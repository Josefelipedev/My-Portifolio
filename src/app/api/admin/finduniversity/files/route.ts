import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

const SCRAPER_URL = process.env.PYTHON_SCRAPER_URL || 'http://localhost:8000';

interface ScrapedFile {
  filename: string;
  path: string;
  size_bytes: number;
  size_mb: number;
  created_at: string;
}

/**
 * GET /api/admin/finduniversity/files
 *
 * List all saved JSON files from the Python scraper.
 * Proxies to: SCRAPER_URL/eduportugal/files
 */
export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch files list from Python scraper
    const response = await fetch(`${SCRAPER_URL}/eduportugal/files`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch files from scraper', files: [] },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform the data for frontend
    const files: ScrapedFile[] = (data.files || []).map(
      (file: {
        filename: string;
        path: string;
        size_bytes: number;
        size_mb: number;
        created_at: string;
      }) => ({
        filename: file.filename,
        path: file.path,
        size_bytes: file.size_bytes,
        size_mb: file.size_mb,
        created_at: file.created_at,
      })
    );

    return NextResponse.json({
      files,
      total: files.length,
      scraper_url: SCRAPER_URL,
    });
  } catch (error) {
    console.error('Error fetching files:', error);

    // Return empty list if scraper is not available
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({
        files: [],
        total: 0,
        error: 'Scraper not available (timeout)',
      });
    }

    return NextResponse.json({
      files: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch files',
    });
  }
}
