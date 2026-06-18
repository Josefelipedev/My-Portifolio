// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
});

const db = vi.hoisted(() => ({
  session: { findFirst: vi.fn() },
  systemLog: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn(), deleteMany: vi.fn() },
  pipelineExecution: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    deleteMany: vi.fn(),
  },
  agentExecution: { groupBy: vi.fn() },
  siteStats: { findUnique: vi.fn(), upsert: vi.fn() },
  pageView: {
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
}));
vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/ai-tracking', () => ({
  getUsageStats: vi.fn(),
  checkQuotaLimits: vi.fn(),
  updateQuotaLimits: vi.fn(),
  getTodayUsage: vi.fn(),
  getMonthUsage: vi.fn(),
}));
// app.ts imports several routes that pull in email/claude libs; stub them so the
// mocked-db env doesn't try to reach real services.
vi.mock('../../../apps/api/src/lib/email', () => ({ sendContactNotification: vi.fn() }));

import app from '../../../apps/api/src/app';

const CSRF = 'a'.repeat(64);

async function token() {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return new SignJWT({ userId: 'u1', sessionToken: 's1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

async function authed(path: string, method: string, body?: unknown) {
  const jwt = await token();
  return app.fetch(
    new Request(`http://local${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        cookie: `auth_token=${jwt}; csrf_token=${CSRF}`,
        'x-csrf-token': CSRF,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  db.session.findFirst.mockResolvedValue({ id: 's', userId: 'u1', token: 's1', isValid: true });
});

describe('admin-observability auth', () => {
  it('401s on an admin read (analytics GET) without auth', async () => {
    const res = await app.fetch(new Request('http://local/api/analytics'));
    expect(res.status).toBe(401);
  });

  it('requires auth for ai-usage and agent-tracking (no global middleware here)', async () => {
    expect((await app.fetch(new Request('http://local/api/admin/ai-usage'))).status).toBe(401);
    expect((await app.fetch(new Request('http://local/api/admin/agent-tracking'))).status).toBe(401);
  });
});

describe('admin-observability reads', () => {
  it('returns the logs list + pagination + stats shape', async () => {
    db.systemLog.findMany.mockResolvedValue([{ id: 'l1', level: 'error', source: 'api', message: 'boom' }]);
    db.systemLog.count.mockResolvedValue(1);
    db.systemLog.groupBy
      .mockResolvedValueOnce([{ level: 'error', _count: 2 }]) // byLevel
      .mockResolvedValueOnce([{ source: 'api', _count: 2 }]); // errorsBySource

    const res = await authed('/api/admin/logs', 'GET');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logs).toHaveLength(1);
    expect(body.pagination).toEqual({ page: 1, limit: 50, total: 1, pages: 1 });
    expect(body.stats.byLevel).toMatchObject({ error: 2, warn: 0, info: 0, debug: 0 });
    expect(body.stats.errorsBySource).toEqual({ api: 2 });
  });
});

describe('admin-observability public visits POST', () => {
  it('records a page view without auth and returns visit counts', async () => {
    db.pageView.findFirst.mockResolvedValue(null);
    db.pageView.create.mockResolvedValue({ id: 'pv1' });
    db.siteStats.upsert.mockResolvedValue({ totalVisits: 5, uniqueVisits: 3 });

    const res = await app.fetch(
      new Request('http://local/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-agent': 'Mozilla Firefox' },
        body: JSON.stringify({ page: '/about' }),
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ totalVisits: 5, uniqueVisits: 3, isNewVisitor: true });
    expect(db.pageView.create).toHaveBeenCalledOnce();
    // new visitor -> a visitor_id cookie is set
    expect(res.headers.get('set-cookie')).toContain('visitor_id=');
  });
});

describe('admin-observability deletes', () => {
  it('clears logs (authed + csrf) and returns the deleted count', async () => {
    db.systemLog.deleteMany.mockResolvedValue({ count: 7 });
    const res = await authed('/api/admin/logs', 'DELETE');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ deleted: 7, message: 'Deleted 7 log entries' });
    expect(db.systemLog.deleteMany).toHaveBeenCalledOnce();
  });
});
