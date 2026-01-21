import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

const PYTHON_SCRAPER_URL = process.env.PYTHON_SCRAPER_URL || 'http://localhost:8000';

interface ScraperHealth {
  status: string;
  uptime?: number;
  version?: string;
  sources?: string[];
}

interface ScraperStats {
  requests_total?: number;
  requests_success?: number;
  requests_failed?: number;
  jobs_found?: number;
  uptime_seconds?: number;
  uptime_human?: string;
}

interface ScraperLog {
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    // Check if scraper is available
    let isAvailable = false;
    let health: ScraperHealth | null = null;
    let stats: ScraperStats | null = null;
    let sources: string[] = [];

    try {
      // Health check
      const healthResponse = await fetch(`${PYTHON_SCRAPER_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      });

      if (healthResponse.ok) {
        isAvailable = true;
        health = await healthResponse.json();
      }
    } catch {
      // Scraper not available
    }

    if (isAvailable) {
      try {
        // Get sources
        const sourcesResponse = await fetch(`${PYTHON_SCRAPER_URL}/sources`, {
          signal: AbortSignal.timeout(5000),
        });
        if (sourcesResponse.ok) {
          const data = await sourcesResponse.json();
          sources = data.sources || [];
        }
      } catch {
        // Ignore
      }

      try {
        // Get stats if available
        const statsResponse = await fetch(`${PYTHON_SCRAPER_URL}/stats`, {
          signal: AbortSignal.timeout(5000),
        });
        if (statsResponse.ok) {
          stats = await statsResponse.json();
        }
      } catch {
        // Stats endpoint may not exist
      }
    }

    // If action is 'logs', fetch logs from Python scraper
    if (action === 'logs' && isAvailable) {
      try {
        const limit = searchParams.get('limit') || '50';
        const level = searchParams.get('level');

        let logsUrl = `${PYTHON_SCRAPER_URL}/logs?limit=${limit}`;
        if (level) logsUrl += `&level=${level}`;

        const logsResponse = await fetch(logsUrl, {
          signal: AbortSignal.timeout(5000),
        });

        if (logsResponse.ok) {
          const logsData = await logsResponse.json();
          return NextResponse.json({
            available: true,
            logs: logsData.logs as ScraperLog[],
            total: logsData.total,
          });
        }
      } catch (error) {
        return NextResponse.json({
          available: true,
          logs: [],
          error: error instanceof Error ? error.message : 'Failed to fetch logs',
        });
      }
    }

    // If action is 'test', try a test scrape
    if (action === 'test' && isAvailable) {
      const source = searchParams.get('source') || 'geekhunter';
      const keyword = searchParams.get('keyword') || 'desenvolvedor';

      try {
        const testUrl = `${PYTHON_SCRAPER_URL}/search/${source}?keyword=${encodeURIComponent(keyword)}&limit=5`;
        const testResponse = await fetch(testUrl, {
          signal: AbortSignal.timeout(60000), // 60s for scraping
        });

        const testData = await testResponse.json();

        return NextResponse.json({
          available: true,
          health,
          sources,
          stats,
          test: {
            source,
            keyword,
            success: testResponse.ok,
            jobsFound: testData.jobs?.length || 0,
            errors: testData.errors || [],
            timestamp: testData.timestamp,
          },
        });
      } catch (error) {
        return NextResponse.json({
          available: true,
          health,
          sources,
          stats,
          test: {
            source,
            keyword,
            success: false,
            error: error instanceof Error ? error.message : 'Test failed',
          },
        });
      }
    }

    // Fetch recent logs if available
    let logs: ScraperLog[] = [];
    if (isAvailable) {
      try {
        const logsResponse = await fetch(`${PYTHON_SCRAPER_URL}/logs?limit=20`, {
          signal: AbortSignal.timeout(5000),
        });
        if (logsResponse.ok) {
          const logsData = await logsResponse.json();
          logs = logsData.logs || [];
        }
      } catch {
        // Ignore logs fetch error
      }
    }

    return NextResponse.json({
      available: isAvailable,
      url: PYTHON_SCRAPER_URL,
      health,
      sources,
      stats,
      logs,
      message: isAvailable
        ? 'Python scraper is running'
        : 'Python scraper is not available. Start it with: cd job-scraper && docker compose up -d',
    });
  } catch (error) {
    console.error('Error checking scraper status:', error);
    return NextResponse.json(
      { error: 'Failed to check scraper status' },
      { status: 500 }
    );
  }
}
