import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

const SCRAPER_URL = process.env.PYTHON_SCRAPER_URL || 'http://localhost:8000';

/**
 * GET /api/admin/finduniversity/files/[filename]
 *
 * Download a specific JSON file from the Python scraper.
 * Proxies to: SCRAPER_URL/eduportugal/files/{filename}
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filename } = await params;

    // Security check - prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    // Only allow .json files
    if (!filename.endsWith('.json')) {
      return NextResponse.json({ error: 'Only JSON files are allowed' }, { status: 400 });
    }

    // Check if client wants to view (inline) or download
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'download';

    // Fetch file from Python scraper
    const response = await fetch(
      `${SCRAPER_URL}/eduportugal/files/${encodeURIComponent(filename)}`,
      {
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: 'Failed to fetch file from scraper' },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'application/json';
    const buffer = await response.arrayBuffer();

    // Return file with appropriate headers
    const headers: HeadersInit = {
      'Content-Type': contentType,
    };

    if (action === 'download') {
      headers['Content-Disposition'] = `attachment; filename="${filename}"`;
    } else {
      // For viewing, return as inline
      headers['Content-Disposition'] = `inline; filename="${filename}"`;
    }

    return new NextResponse(buffer, { headers });
  } catch (error) {
    console.error('Error fetching file:', error);

    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Scraper not available (timeout)' }, { status: 504 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch file' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/finduniversity/files/[filename]
 *
 * Delete a specific JSON file from the Python scraper.
 * Proxies to: SCRAPER_URL/eduportugal/files/{filename}
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filename } = await params;

    // Security check - prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    // Only allow .json files
    if (!filename.endsWith('.json')) {
      return NextResponse.json({ error: 'Only JSON files can be deleted' }, { status: 400 });
    }

    // Delete file from Python scraper
    const response = await fetch(
      `${SCRAPER_URL}/eduportugal/files/${encodeURIComponent(filename)}`,
      {
        method: 'DELETE',
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return NextResponse.json(
        { error: error.detail || 'Failed to delete file' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error deleting file:', error);

    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Scraper not available (timeout)' }, { status: 504 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete file' },
      { status: 500 }
    );
  }
}
