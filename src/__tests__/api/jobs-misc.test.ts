// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
});

const db = vi.hoisted(() => ({
  session: { findFirst: vi.fn() },
  savedJob: { findMany: vi.fn(), count: vi.fn() },
  jobApplication: { findMany: vi.fn() },
  jobSearchHistory: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  jobAlert: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
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
  generateSkillsSuggestion: vi.fn(),
  analyzeReadmeForProject: vi.fn(),
  analyzeResumePDF: vi.fn(),
  getCurrentAIProvider: vi.fn(() => ({ provider: 'together', model: 'm' })),
}));

import app from '../../../apps/api/src/app';

const CSRF = 'a'.repeat(64);
async function jwt() {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return new SignJWT({ userId: 'u1', sessionToken: 's1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}
async function call(path: string, method = 'GET', body?: unknown) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    cookie: `auth_token=${await jwt()}; csrf_token=${CSRF}`,
    'x-csrf-token': CSRF,
  };
  return app.fetch(
    new Request(`http://local${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  db.session.findFirst.mockResolvedValue({ id: 's', userId: 'u1', token: 's1', isValid: true });
});

describe('jobs/analytics', () => {
  it('401s without auth', async () => {
    expect((await app.fetch(new Request('http://local/api/jobs/analytics'))).status).toBe(401);
  });

  it('returns the analytics shape', async () => {
    db.jobApplication.findMany.mockResolvedValue([
      { id: 'a1', status: 'offer', createdAt: new Date(), appliedAt: null, savedJob: { source: 'linkedin', company: 'Acme' }, timeline: null },
    ]);
    db.savedJob.count.mockResolvedValue(3);
    db.jobSearchHistory.count.mockResolvedValue(2);
    db.savedJob.findMany
      .mockResolvedValueOnce([{ savedAt: new Date() }]) // weekly activity query
      .mockResolvedValueOnce([{ tags: 'react,node', savedAt: new Date(), application: { id: 'x' } }]); // tags query

    const res = await call('/api/jobs/analytics');
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      funnel: { saved: number; offer: number };
      totalSavedJobs: number;
      totalApplications: number;
      recentSearches: number;
      sourceEffectiveness: { source: string }[];
    };
    expect(json.funnel.saved).toBe(3);
    expect(json.funnel.offer).toBe(1);
    expect(json.totalSavedJobs).toBe(3);
    expect(json.totalApplications).toBe(1);
    expect(json.recentSearches).toBe(2);
    expect(json.sourceEffectiveness[0].source).toBe('linkedin');
  });
});

describe('jobs/history', () => {
  it('401s the list without auth', async () => {
    expect((await app.fetch(new Request('http://local/api/jobs/history'))).status).toBe(401);
  });

  it('returns history with isCached computed', async () => {
    const future = new Date(Date.now() + 60_000);
    db.jobSearchHistory.findMany.mockResolvedValue([
      { id: 'h1', keyword: 'react', countries: 'all', sources: 'all', filters: null, resultCount: 5, cachedUntil: future, searchedAt: new Date() },
      { id: 'h2', keyword: 'node', countries: 'all', sources: 'all', filters: null, resultCount: 1, cachedUntil: null, searchedAt: new Date() },
    ]);
    const res = await call('/api/jobs/history?limit=10');
    expect(res.status).toBe(200);
    const json = (await res.json()) as { id: string; isCached: boolean }[];
    expect(json[0].isCached).toBe(true);
    expect(json[1].isCached).toBe(false);
  });

  it('creates a new history entry (201)', async () => {
    db.jobSearchHistory.findFirst.mockResolvedValue(null);
    db.jobSearchHistory.create.mockResolvedValue({ id: 'h3' });
    const res = await call('/api/jobs/history', 'POST', { keyword: 'react' });
    expect(res.status).toBe(201);
    expect(db.jobSearchHistory.create).toHaveBeenCalled();
  });

  it('400s create without keyword', async () => {
    const res = await call('/api/jobs/history', 'POST', { countries: 'all' });
    expect(res.status).toBe(400);
  });

  it('deletes a single history entry by id', async () => {
    db.jobSearchHistory.delete.mockResolvedValue({});
    const res = await call('/api/jobs/history?id=h1', 'DELETE');
    expect(res.status).toBe(200);
    expect(db.jobSearchHistory.delete).toHaveBeenCalledWith({ where: { id: 'h1' } });
  });

  it('clears all history when no id', async () => {
    db.jobSearchHistory.deleteMany.mockResolvedValue({ count: 4 });
    const res = await call('/api/jobs/history', 'DELETE');
    expect(res.status).toBe(200);
    expect(db.jobSearchHistory.deleteMany).toHaveBeenCalledWith({});
  });
});

describe('jobs/alerts', () => {
  it('401s the list without auth', async () => {
    expect((await app.fetch(new Request('http://local/api/jobs/alerts'))).status).toBe(401);
  });

  it('lists alerts with matches include', async () => {
    db.jobAlert.findMany.mockResolvedValue([{ id: 'al1', matches: [], _count: { matches: 0 } }]);
    const res = await call('/api/jobs/alerts');
    expect(res.status).toBe(200);
    expect(db.jobAlert.findMany).toHaveBeenCalled();
  });

  it('creates an alert (201)', async () => {
    db.jobAlert.create.mockResolvedValue({ id: 'al2' });
    const res = await call('/api/jobs/alerts', 'POST', { name: 'My alert', keyword: 'react' });
    expect(res.status).toBe(201);
    expect(db.jobAlert.create).toHaveBeenCalled();
  });

  it('400s create without name/keyword', async () => {
    const res = await call('/api/jobs/alerts', 'POST', { name: 'x' });
    expect(res.status).toBe(400);
  });

  it('deletes an alert by id', async () => {
    db.jobAlert.delete.mockResolvedValue({});
    const res = await call('/api/jobs/alerts?id=al1', 'DELETE');
    expect(res.status).toBe(200);
    expect(db.jobAlert.delete).toHaveBeenCalledWith({ where: { id: 'al1' } });
  });

  it('400s delete without id', async () => {
    const res = await call('/api/jobs/alerts', 'DELETE');
    expect(res.status).toBe(400);
  });
});
