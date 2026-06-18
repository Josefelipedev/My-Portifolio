import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API service's prisma client before importing the Hono app, so these
// tests exercise routing/headers/error-shape without a real database.
const findMany = vi.hoisted(() => ({
  project: vi.fn(),
  skill: vi.fn(),
  experience: vi.fn(),
  education: vi.fn(),
}));
vi.mock('../../../apps/api/src/db', () => ({
  default: {
    project: { findMany: findMany.project },
    skill: { findMany: findMany.skill },
    experience: { findMany: findMany.experience },
    education: { findMany: findMany.education },
  },
}));

import app from '../../../apps/api/src/app';
import { projectListSchema } from '@portfolio/shared';

const sampleProject = {
  id: 'p1', title: 'P', description: 'd', readme: null, technologies: 'TS',
  repoUrl: null, demoUrl: null, githubId: null, source: 'manual', aiSummary: null,
  aiSummarizedAt: null, imageUrl: null, stars: null, featured: false, rank: null,
  isPrivate: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

const call = (path: string) => app.fetch(new Request(`http://local${path}`));

beforeEach(() => {
  Object.values(findMany).forEach((f) => f.mockReset().mockResolvedValue([]));
});

describe('apps/api content routes', () => {
  it('GET /api/projects returns contract-valid JSON with cache headers', async () => {
    findMany.project.mockResolvedValue([sampleProject]);
    const res = await call('/api/projects');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=60, stale-while-revalidate=300');
    const body = projectListSchema.parse(await res.json());
    expect(body[0].title).toBe('P');
  });

  it('orders projects by rank/featured/stars/createdAt', async () => {
    await call('/api/projects');
    expect(findMany.project).toHaveBeenCalledWith({
      orderBy: [{ rank: 'asc' }, { featured: 'desc' }, { stars: 'desc' }, { createdAt: 'desc' }],
    });
  });

  it('serves skills, experiences and education', async () => {
    for (const p of ['/api/skills', '/api/experiences', '/api/education']) {
      expect((await call(p)).status).toBe(200);
    }
  });

  it('returns the shared error shape on 404', async () => {
    const res = await call('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found', code: 'NOT_FOUND' });
  });
});
