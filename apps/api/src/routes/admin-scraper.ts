// Admin — Python job-scraper proxy. Ported from the web app's
// src/app/api/admin/scraper-logs route. Proxies health/stats/logs/debug/test to
// the multiscraper service. The API container uses host networking, so the
// default localhost:8001 reaches the scraper on the host. Authenticated.

import { Hono } from 'hono';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { logger } from '../lib/logger';
import { sendScraperAlert } from '../lib/email';

const adminScraper = new Hono<AuthEnv>();

const PYTHON_SCRAPER_URL = process.env.PYTHON_SCRAPER_URL || 'http://localhost:8001';
const T = (ms: number) => AbortSignal.timeout(ms);
// The scraper's JSON shapes are loose/external; read them untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsonAny = (r: Response): Promise<any> => r.json();

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

adminScraper.get('/admin/scraper-logs', requireAuth, async (c) => {
  const action = c.req.query('action') || 'status';

  // Health check
  let isAvailable = false;
  let health: unknown = null;
  try {
    const r = await fetch(`${PYTHON_SCRAPER_URL}/health`, { signal: T(5000) });
    if (r.ok) {
      isAvailable = true;
      health = await jsonAny(r);
    }
  } catch {
    /* scraper not available */
  }

  // Sources + stats (best-effort)
  let sources: string[] = [];
  let stats: unknown = null;
  if (isAvailable) {
    try {
      const r = await fetch(`${PYTHON_SCRAPER_URL}/jobs/sources`, { signal: T(5000) });
      if (r.ok) sources = (await jsonAny(r)).sources || [];
    } catch {
      /* ignore */
    }
    try {
      const r = await fetch(`${PYTHON_SCRAPER_URL}/jobs/stats`, { signal: T(5000) });
      if (r.ok) stats = await jsonAny(r);
    } catch {
      /* ignore */
    }
  }

  // action: logs
  if (action === 'logs' && isAvailable) {
    try {
      const limit = c.req.query('limit') || '50';
      const level = c.req.query('level');
      let url = `${PYTHON_SCRAPER_URL}/logs?limit=${limit}`;
      if (level) url += `&level=${level}`;
      const r = await fetch(url, { signal: T(5000) });
      if (r.ok) {
        const d = await jsonAny(r);
        return c.json({ available: true, logs: d.logs as ScraperLog[], total: d.total });
      }
    } catch (e) {
      return c.json({ available: true, logs: [], error: e instanceof Error ? e.message : 'Failed to fetch logs' });
    }
  }

  // action: clear-logs
  if (action === 'clear-logs' && isAvailable) {
    try {
      const r = await fetch(`${PYTHON_SCRAPER_URL}/logs`, { method: 'DELETE', signal: T(5000) });
      if (r.ok) return c.json({ success: true, cleared: (await jsonAny(r)).cleared });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : 'Failed to clear logs' }, 500);
    }
  }

  // action: debug
  if (action === 'debug' && isAvailable) {
    try {
      const r = await fetch(`${PYTHON_SCRAPER_URL}/debug`, { signal: T(5000) });
      if (r.ok) {
        const d = await jsonAny(r);
        return c.json({ available: true, debug: { enabled: d.enabled, files: d.files as DebugFile[], total: d.total || 0 } });
      }
    } catch (e) {
      return c.json({ available: true, debug: { enabled: false, files: [], error: e instanceof Error ? e.message : 'Failed' } });
    }
  }

  // action: debug-file (proxies the raw file)
  if (action === 'debug-file' && isAvailable) {
    const filename = c.req.query('filename');
    if (!filename) return c.json({ error: 'Filename required' }, 400);
    try {
      const r = await fetch(`${PYTHON_SCRAPER_URL}/debug/${encodeURIComponent(filename)}`, { signal: T(30000) });
      if (!r.ok) return c.json({ error: 'File not found' }, 404);
      const contentType = r.headers.get('content-type') || 'application/octet-stream';
      const buffer = await r.arrayBuffer();
      return c.body(buffer, 200, {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
      });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : 'Failed to fetch file' }, 500);
    }
  }

  // action: clear-debug
  if (action === 'clear-debug' && isAvailable) {
    try {
      const r = await fetch(`${PYTHON_SCRAPER_URL}/debug`, { method: 'DELETE', signal: T(5000) });
      if (r.ok) return c.json({ success: true, deleted: (await jsonAny(r)).deleted });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : 'Failed to clear debug files' }, 500);
    }
  }

  // action: test (runs a small scrape, logs, optional email alert)
  if (action === 'test' && isAvailable) {
    const source = c.req.query('source') || 'geekhunter';
    const keyword = c.req.query('keyword') || 'desenvolvedor';
    const sendAlert = c.req.query('alert') === 'true';
    const logSource = source === 'geekhunter' ? 'geekhunter' : source === 'vagascombr' ? 'vagascombr' : 'python-scraper';
    try {
      const url = `${PYTHON_SCRAPER_URL}/jobs/search/${source}?keyword=${encodeURIComponent(keyword)}&limit=5`;
      const r = await fetch(url, { signal: T(60000) });
      const d = await jsonAny(r);
      const jobsFound = d.jobs?.length || 0;
      if (jobsFound === 0) {
        logger.warn(logSource, `Test scrape found 0 jobs for "${keyword}"`, { source, keyword, errors: d.errors });
        if (sendAlert) await sendScraperAlert(source, keyword, 0, d.errors?.join(', '));
      } else {
        logger.info(logSource, `Test scrape found ${jobsFound} jobs for "${keyword}"`, { source, keyword, count: jobsFound });
      }
      return c.json({
        available: true,
        health,
        sources,
        stats,
        test: { source, keyword, success: r.ok && jobsFound > 0, jobsFound, errors: d.errors || [], timestamp: d.timestamp, alertSent: sendAlert && jobsFound === 0 },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Test failed';
      logger.error('python-scraper', `Test scrape failed: ${msg}`, { source, keyword, error: msg });
      if (sendAlert) await sendScraperAlert(source, keyword, 0, msg);
      return c.json({ available: true, health, sources, stats, test: { source, keyword, success: false, error: msg, alertSent: sendAlert } });
    }
  }

  // default: status (+ recent logs and debug info)
  let logs: ScraperLog[] = [];
  let debugFiles: DebugFile[] = [];
  let debugEnabled = false;
  if (isAvailable) {
    try {
      const r = await fetch(`${PYTHON_SCRAPER_URL}/logs?limit=20`, { signal: T(5000) });
      if (r.ok) logs = (await jsonAny(r)).logs || [];
    } catch {
      /* ignore */
    }
    try {
      const r = await fetch(`${PYTHON_SCRAPER_URL}/debug`, { signal: T(5000) });
      if (r.ok) {
        const d = await jsonAny(r);
        debugEnabled = d.enabled || false;
        debugFiles = d.files || [];
      }
    } catch {
      /* ignore */
    }
  }

  return c.json({
    available: isAvailable,
    url: PYTHON_SCRAPER_URL,
    health,
    sources,
    stats,
    logs,
    debug: { enabled: debugEnabled, files: debugFiles, total: debugFiles.length },
    message: isAvailable ? 'Python scraper is running' : 'Scraper not available.',
  });
});

export default adminScraper;
