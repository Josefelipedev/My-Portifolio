import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API service's prisma client before importing the Hono app, so these
// tests exercise routing/headers/error-shape without a real database.
const db = vi.hoisted(() => ({
  gitHubRepoCache: { findMany: vi.fn() },
  // The content router shares this client; stub the models it touches so the
  // app module loads cleanly.
  project: { findMany: vi.fn() },
  skill: { findMany: vi.fn() },
  experience: { findMany: vi.fn() },
  education: { findMany: vi.fn() },
  wakaTimeYearCache: { findMany: vi.fn(), findUnique: vi.fn() },
}));
vi.mock('../../../apps/api/src/db', () => ({ default: db }));

import app from '../../../apps/api/src/app';
import { githubRepoListSchema } from '@portfolio/shared';

const sampleRepo = {
  id: 1,
  name: 'portfolio',
  fullName: 'josefelipedev/portfolio',
  description: null,
  htmlUrl: 'https://github.com/josefelipedev/portfolio',
  homepage: null,
  language: 'TypeScript',
  topics: 'nextjs,hono',
  stargazers: 42,
  forksCount: 3,
  updatedAt: '2026-01-01T00:00:00.000Z',
  cachedAt: '2026-01-02T00:00:00.000Z',
};

const call = (path: string) => app.fetch(new Request(`http://local${path}`));

beforeEach(() => {
  db.gitHubRepoCache.findMany.mockReset().mockResolvedValue([]);
});

describe('apps/api github routes', () => {
  it('GET /api/github/repos returns contract-valid JSON with cache headers', async () => {
    db.gitHubRepoCache.findMany.mockResolvedValue([sampleRepo]);
    const res = await call('/api/github/repos');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe(
      'public, s-maxage=60, stale-while-revalidate=300',
    );
    const body = githubRepoListSchema.parse(await res.json());
    expect(body[0].fullName).toBe('josefelipedev/portfolio');
  });

  it('orders cached repos by stargazers then updatedAt', async () => {
    await call('/api/github/repos');
    expect(db.gitHubRepoCache.findMany).toHaveBeenCalledWith({
      orderBy: [{ stargazers: 'desc' }, { updatedAt: 'desc' }],
    });
  });

  it('returns an empty array when the cache is empty', async () => {
    const res = await call('/api/github/repos');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
