import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

const SCRAPER_URL = process.env.PYTHON_SCRAPER_URL || 'http://localhost:8000';

/**
 * POST /api/admin/finduniversity/manual-extract
 *
 * Proxy for the Python scraper's DGES manual extract endpoint.
 * This allows the frontend to call the scraper without CORS issues.
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.content || !body.content_type || !body.extraction_mode) {
      return NextResponse.json(
        { error: 'Missing required fields: content, content_type, extraction_mode' },
        { status: 400 }
      );
    }

    // Call the Python scraper
    const scraperResponse = await fetch(`${SCRAPER_URL}/dges/manual/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content_type: body.content_type,
        content: body.content,
        extraction_mode: body.extraction_mode,
        region: body.region || null,
      }),
    });

    if (!scraperResponse.ok) {
      const errorData = await scraperResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || `Scraper error: ${scraperResponse.status}` },
        { status: scraperResponse.status }
      );
    }

    const data = await scraperResponse.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Manual extract proxy error:', error);

    // Check if it's a connection error
    if (error instanceof Error && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Scraper Python nao esta disponivel. Execute: cd job-scraper && docker-compose up -d' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process extraction request' },
      { status: 500 }
    );
  }
}
