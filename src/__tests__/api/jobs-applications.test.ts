// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
});

const db = vi.hoisted(() => ({
  session: { findFirst: vi.fn() },
  savedJob: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  jobApplication: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
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

describe('jobs/applications', () => {
  it('401s the list without auth', async () => {
    expect((await app.fetch(new Request('http://local/api/jobs/applications'))).status).toBe(401);
  });

  it('lists applications with savedJob include and status filter', async () => {
    db.jobApplication.findMany.mockResolvedValue([{ id: 'a1', status: 'applied' }]);
    const res = await call('/api/jobs/applications?status=applied');
    expect(res.status).toBe(200);
    expect(db.jobApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'applied' } }),
    );
    expect((await res.json()) as unknown[]).toHaveLength(1);
  });

  it('creates a manual application (201) with timeline', async () => {
    db.jobApplication.create.mockImplementation(({ data }: { data: unknown }) => ({ id: 'a2', ...(data as object) }));
    const res = await call('/api/jobs/applications', 'POST', { title: 't', company: 'c' });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { status: string; timeline: string };
    expect(json.status).toBe('saved');
    expect(JSON.parse(json.timeline)[0].note).toBe('Application created manually');
  });

  it('400s create when a required field is missing', async () => {
    const res = await call('/api/jobs/applications', 'POST', { title: 't' });
    expect(res.status).toBe(400);
  });

  it('bulk-updates status with timeline entries', async () => {
    db.jobApplication.findMany.mockResolvedValue([
      { id: 'a', timeline: null },
      { id: 'b', timeline: JSON.stringify([{ status: 'saved' }]) },
    ]);
    db.jobApplication.update.mockResolvedValue({});
    const res = await call('/api/jobs/applications/bulk', 'PUT', { ids: ['a', 'b'], status: 'applied' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { count: number };
    expect(json.count).toBe(2);
    expect(db.jobApplication.update).toHaveBeenCalledTimes(2);
  });

  it('400s bulk update with an invalid status', async () => {
    const res = await call('/api/jobs/applications/bulk', 'PUT', { ids: ['a'], status: 'nope' });
    expect(res.status).toBe(400);
  });

  it('bulk-deletes applications', async () => {
    db.jobApplication.deleteMany.mockResolvedValue({ count: 3 });
    const res = await call('/api/jobs/applications/bulk', 'DELETE', { ids: ['a', 'b', 'c'] });
    expect(res.status).toBe(200);
    expect(db.jobApplication.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['a', 'b', 'c'] } } });
    expect(((await res.json()) as { count: number }).count).toBe(3);
  });

  it('updates a single application', async () => {
    db.jobApplication.findUnique.mockResolvedValue({ id: 'a1', status: 'saved', timeline: null, title: 'old' });
    db.jobApplication.update.mockImplementation(({ data }: { data: unknown }) => ({ id: 'a1', ...(data as object) }));
    const res = await call('/api/jobs/applications/a1', 'PUT', { status: 'interview' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; timeline: string };
    expect(json.status).toBe('interview');
    expect(JSON.parse(json.timeline)[0].status).toBe('interview');
  });

  it('404s a missing single application', async () => {
    db.jobApplication.findUnique.mockResolvedValue(null);
    expect((await call('/api/jobs/applications/nope')).status).toBe(404);
  });
});
