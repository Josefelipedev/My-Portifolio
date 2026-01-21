import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { sendScraperAlert } from '@/lib/email';

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

interface DebugFile {
  name: string;
  size: number;
  created: string;
  type: 'screenshot' | 'html';
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

    // If action is 'debug', fetch debug files
    if (action === 'debug' && isAvailable) {
      try {
        const debugResponse = await fetch(`${PYTHON_SCRAPER_URL}/debug`, {
          signal: AbortSignal.timeout(5000),
        });

        if (debugResponse.ok) {
          const debugData = await debugResponse.json();
          return NextResponse.json({
            available: true,
            debug: {
              enabled: debugData.enabled,
              files: debugData.files as DebugFile[],
              total: debugData.total || 0,
            },
          });
        }
      } catch (error) {
        return NextResponse.json({
          available: true,
          debug: {
            enabled: false,
            files: [],
            error: error instanceof Error ? error.message : 'Failed to fetch debug files',
          },
        });
      }
    }

    // If action is 'debug-file', proxy a specific debug file
    if (action === 'debug-file' && isAvailable) {
      const filename = searchParams.get('filename');
      if (!filename) {
        return NextResponse.json({ error: 'Filename required' }, { status: 400 });
      }

      try {
        const fileResponse = await fetch(`${PYTHON_SCRAPER_URL}/debug/${encodeURIComponent(filename)}`, {
          signal: AbortSignal.timeout(30000),
        });

        if (!fileResponse.ok) {
          return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
        const buffer = await fileResponse.arrayBuffer();

        return new NextResponse(buffer, {
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `inline; filename="${filename}"`,
          },
        });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to fetch file' },
          { status: 500 }
        );
      }
    }

    // If action is 'clear-debug', clear debug files
    if (action === 'clear-debug' && isAvailable) {
      try {
        const clearResponse = await fetch(`${PYTHON_SCRAPER_URL}/debug`, {
          method: 'DELETE',
          signal: AbortSignal.timeout(5000),
        });

        if (clearResponse.ok) {
          const data = await clearResponse.json();
          return NextResponse.json({
            success: true,
            deleted: data.deleted,
          });
        }
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to clear debug files' },
          { status: 500 }
        );
      }
    }

    // If action is 'test', try a test scrape
    if (action === 'test' && isAvailable) {
      const source = searchParams.get('source') || 'geekhunter';
      const keyword = searchParams.get('keyword') || 'desenvolvedor';
      const sendAlert = searchParams.get('alert') === 'true';

      try {
        const testUrl = `${PYTHON_SCRAPER_URL}/search/${source}?keyword=${encodeURIComponent(keyword)}&limit=5`;
        const testResponse = await fetch(testUrl, {
          signal: AbortSignal.timeout(60000), // 60s for scraping
        });

        const testData = await testResponse.json();
        const jobsFound = testData.jobs?.length || 0;

        // Log to system logs
        const logSource = source === 'geekhunter' ? 'geekhunter' : source === 'vagascombr' ? 'vagascombr' : 'python-scraper';
        if (jobsFound === 0) {
          logger.warn(logSource as 'geekhunter' | 'vagascombr' | 'python-scraper', `Test scrape found 0 jobs for "${keyword}"`, {
            source,
            keyword,
            errors: testData.errors,
          });

          // Send email alert if requested
          if (sendAlert) {
            await sendScraperAlert(source, keyword, 0, testData.errors?.join(', '));
          }
        } else {
          logger.info(logSource as 'geekhunter' | 'vagascombr' | 'python-scraper', `Test scrape found ${jobsFound} jobs for "${keyword}"`, {
            source,
            keyword,
            count: jobsFound,
          });
        }

        return NextResponse.json({
          available: true,
          health,
          sources,
          stats,
          test: {
            source,
            keyword,
            success: testResponse.ok && jobsFound > 0,
            jobsFound,
            errors: testData.errors || [],
            timestamp: testData.timestamp,
            alertSent: sendAlert && jobsFound === 0,
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Test failed';

        // Log error to system logs
        logger.error('python-scraper', `Test scrape failed: ${errorMessage}`, {
          source,
          keyword,
          error: errorMessage,
        });

        // Send alert on error if requested
        if (sendAlert) {
          await sendScraperAlert(source, keyword, 0, errorMessage);
        }

        return NextResponse.json({
          available: true,
          health,
          sources,
          stats,
          test: {
            source,
            keyword,
            success: false,
            error: errorMessage,
            alertSent: sendAlert,
          },
        });
      }
    }

    // Fetch recent logs if available
    let logs: ScraperLog[] = [];
    let debugFiles: DebugFile[] = [];
    let debugEnabled = false;

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

      // Fetch debug files info
      try {
        const debugResponse = await fetch(`${PYTHON_SCRAPER_URL}/debug`, {
          signal: AbortSignal.timeout(5000),
        });
        if (debugResponse.ok) {
          const debugData = await debugResponse.json();
          debugEnabled = debugData.enabled || false;
          debugFiles = debugData.files || [];
        }
      } catch {
        // Ignore debug fetch error
      }
    }

    return NextResponse.json({
      available: isAvailable,
      url: PYTHON_SCRAPER_URL,
      health,
      sources,
      stats,
      logs,
      debug: {
        enabled: debugEnabled,
        files: debugFiles,
        total: debugFiles.length,
      },
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
