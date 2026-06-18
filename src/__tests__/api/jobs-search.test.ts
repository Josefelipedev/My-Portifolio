// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
});

const db = vi.hoisted(() => ({
  session: { findFirst: vi.fn() },
  jobSearchHistory: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  resumeConfig: { findUnique: vi.fn() },
}));
vi.mock('../../../apps/api/src/db', () => ({ default: db }));

// Mock the aggregator so the route never makes real network calls. The route
// imports searchJobs / getApiStatus / getLastSourceErrors from ../lib/jobs,
// which re-exports them straight from ./aggregator.
const aggregator = vi.hoisted(() => ({
  searchJobs: vi.fn(),
  searchJobsByCountry: vi.fn(),
  getApiStatus: vi.fn(() => [{ name: 'RemoteOK', configured: true, needsKey: false }]),
  getLastSourceErrors: vi.fn(() => []),
}));
vi.mock('../../../apps/api/src/lib/jobs/aggregator', () => aggregator);

import app from '../../../apps/api/src/app';

async function jwt() {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return new SignJWT({ userId: 'u1', sessionToken: 's1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}
async function call(path: string) {
  const headers: Record<string, string> = { cookie: `auth_token=${await jwt()}` };
  return app.fetch(new Request(`http://local${path}`, { method: 'GET', headers }));
}

beforeEach(() => {
  vi.clearAllMocks();
  db.session.findFirst.mockResolvedValue({ id: 's', userId: 'u1', token: 's1', isValid: true });
  aggregator.getApiStatus.mockReturnValue([{ name: 'RemoteOK', configured: true, needsKey: false }]);
  aggregator.getLastSourceErrors.mockReturnValue([]);
});

describe('jobs/search', () => {
  it('401s without a session', async () => {
    const res = await app.fetch(new Request('http://local/api/jobs/search?keyword=node'));
    expect(res.status).toBe(401);
  });

  it('returns the search envelope (aggregator mocked)', async () => {
    aggregator.searchJobs.mockResolvedValue([
      { id: 'j1', source: 'remoteok', title: 'Dev', company: 'Acme', description: '', url: 'u' },
    ]);
    // No keyword => no DB cache read/write path.
    const res = await call('/api/jobs/search?pageSize=10');
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      jobs: unknown[];
      total: number;
      page: number;
      pageSize: number;
      fromCache: boolean;
      sourceErrors: unknown[];
      apis: unknown[];
    };
    expect(aggregator.searchJobs).toHaveBeenCalled();
    expect(json.total).toBe(1);
    expect(json.jobs).toHaveLength(1);
    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(10);
    expect(json.fromCache).toBe(false);
    expect(Array.isArray(json.sourceErrors)).toBe(true);
    expect(Array.isArray(json.apis)).toBe(true);
  });
});
