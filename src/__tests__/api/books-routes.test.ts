import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API service's prisma client before importing the Hono app, so these
// tests exercise routing/headers/contract without a real database.
const findMany = vi.hoisted(() => ({
  project: vi.fn(),
  skill: vi.fn(),
  experience: vi.fn(),
  education: vi.fn(),
  book: vi.fn(),
}));
vi.mock('../../../apps/api/src/db', () => ({
  default: {
    project: { findMany: findMany.project },
    skill: { findMany: findMany.skill },
    experience: { findMany: findMany.experience },
    education: { findMany: findMany.education },
    book: { findMany: findMany.book },
  },
}));

import app from '../../../apps/api/src/app';
import { bookListSchema } from '@portfolio/shared';

const sampleBook = {
  id: 'b1', title: 'Clean Code', author: 'Robert C. Martin', coverUrl: null,
  progress: 42, status: 'reading', startedAt: '2026-01-01T00:00:00.000Z',
  finishedAt: null, rating: null, notes: null, isbn: null, totalPages: 464,
  order: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

const call = (path: string) => app.fetch(new Request(`http://local${path}`));

beforeEach(() => {
  Object.values(findMany).forEach((f) => f.mockReset().mockResolvedValue([]));
});

describe('apps/api books routes', () => {
  it('GET /api/books returns contract-valid JSON with cache headers', async () => {
    findMany.book.mockResolvedValue([sampleBook]);
    const res = await call('/api/books');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=60, stale-while-revalidate=300');
    const body = bookListSchema.parse(await res.json());
    expect(body[0].title).toBe('Clean Code');
  });

  it('orders books by order asc then createdAt desc', async () => {
    await call('/api/books');
    expect(findMany.book).toHaveBeenCalledWith({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
  });
});
