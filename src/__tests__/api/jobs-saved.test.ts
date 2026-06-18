// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
});

const db = vi.hoisted(() => ({
  session: { findFirst: vi.fn() },
  savedJob: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  jobApplication: { count: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
  project: { findMany: vi.fn() },
  experience: { findMany: vi.fn() },
  skill: { findMany: vi.fn() },
  education: { findMany: vi.fn() },
  siteConfig: { findUnique: vi.fn() },
  contactMessage: { create: vi.fn() },
}));
vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/email', () => ({ sendContactNotification: vi.fn() }));
vi.mock('../../../apps/api/src/lib/claude', () => ({
  generateSkillsSuggestion: vi.fn(), analyzeReadmeForProject: vi.fn(), analyzeResumePDF: vi.fn(),
  getCurrentAIProvider: vi.fn(() => ({ provider: 'together', model: 'm' })),
}));

import app from '../../../apps/api/src/app';

const CSRF = 'a'.repeat(64);
async function jwt() {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return new SignJWT({ userId: 'u1', sessionToken: 's1' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
}
async function call(path: string, method = 'GET', body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', cookie: `auth_token=${await jwt()}; csrf_token=${CSRF}`, 'x-csrf-token': CSRF };
  return app.fetch(new Request(`http://local${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }));
}

beforeEach(() => {
  vi.clearAllMocks();
  db.session.findFirst.mockResolvedValue({ id: 's', userId: 'u1', token: 's1', isValid: true });
});

describe('jobs/saved', () => {
  it('401s the list without auth', async () => {
    expect((await app.fetch(new Request('http://local/api/jobs/saved'))).status).toBe(401);
  });

  it('returns a paginated list with application include', async () => {
    db.savedJob.findMany.mockResolvedValue([{ id: 'j1' }]);
    db.savedJob.count.mockResolvedValue(1);
    const res = await call('/api/jobs/saved?page=1&limit=10');
    expect(res.status).toBe(200);
    const json = (await res.json()) as { total: number; totalPages: number; hasMore: boolean };
    expect(json).toMatchObject({ total: 1, totalPages: 1, hasMore: false });
  });

  it('creates a saved job (201) and rejects duplicates (400)', async () => {
    db.savedJob.findUnique.mockResolvedValue(null);
    db.savedJob.create.mockResolvedValue({ id: 'j2' });
    const ok = await call('/api/jobs/saved', 'POST', { externalId: 'x', source: 's', title: 't', company: 'c', url: 'u' });
    expect(ok.status).toBe(201);

    db.savedJob.findUnique.mockResolvedValue({ id: 'dup' });
    const dup = await call('/api/jobs/saved', 'POST', { externalId: 'x', source: 's', title: 't', company: 'c', url: 'u' });
    expect(dup.status).toBe(400);
  });

  it('400s create when a required field is missing', async () => {
    const res = await call('/api/jobs/saved', 'POST', { source: 's' });
    expect(res.status).toBe(400);
  });

  it('404s a missing single job', async () => {
    db.savedJob.findUnique.mockResolvedValue(null);
    expect((await call('/api/jobs/saved/nope')).status).toBe(404);
  });

  it('bulk-deletes jobs and their applications', async () => {
    db.savedJob.deleteMany.mockResolvedValue({ count: 2 });
    const res = await call('/api/jobs/saved/bulk', 'DELETE', { ids: ['a', 'b'] });
    expect(res.status).toBe(200);
    expect(db.jobApplication.deleteMany).toHaveBeenCalledWith({ where: { savedJobId: { in: ['a', 'b'] } } });
    expect((await res.json() as { count: number }).count).toBe(2);
  });

  it('aggregates pipeline stats', async () => {
    db.savedJob.count.mockResolvedValue(7);
    db.jobApplication.count.mockResolvedValue(2);
    db.jobApplication.findMany.mockResolvedValue([]);
    const res = await call('/api/jobs/stats');
    expect(res.status).toBe(200);
    const json = (await res.json()) as { savedJobs: number; applications: { total: number } };
    expect(json.savedJobs).toBe(7);
    expect(json.applications.total).toBe(10); // 2 per each of 5 statuses
  });
});
