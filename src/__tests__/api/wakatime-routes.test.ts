import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API service's prisma client before importing the Hono app, so these
// tests exercise routing/headers/error-shape without a real database.
const db = vi.hoisted(() => ({
  wakaTimeYearCache: { findMany: vi.fn(), findUnique: vi.fn() },
  // Models touched by the other routers mounted on the same app/client.
  gitHubRepoCache: { findMany: vi.fn() },
  project: { findMany: vi.fn() },
  skill: { findMany: vi.fn() },
  experience: { findMany: vi.fn() },
  education: { findMany: vi.fn() },
}));
vi.mock('../../../apps/api/src/db', () => ({ default: db }));

import app from '../../../apps/api/src/app';
import { wakatimeYearListSchema, wakatimeYearSchema } from '@portfolio/shared';

const sampleYear = {
  id: 'year_2024',
  year: 2024,
  totalSeconds: 360000,
  totalHours: '100 hrs',
  dailyAverage: '2 hrs',
  bestDayDate: '2024-06-01',
  bestDaySeconds: 14400,
  bestDayText: '4 hrs',
  languages: '[]',
  editors: '[]',
  operatingSystems: '[]',
  projects: '[]',
  categories: '[]',
  rangeStart: '2024-01-01',
  rangeEnd: '2024-12-31',
  rangeText: 'Last Year',
  cachedAt: '2026-01-02T00:00:00.000Z',
};

const call = (path: string) => app.fetch(new Request(`http://local${path}`));

beforeEach(() => {
  db.wakaTimeYearCache.findMany.mockReset().mockResolvedValue([]);
  db.wakaTimeYearCache.findUnique.mockReset().mockResolvedValue(null);
});

describe('apps/api wakatime routes', () => {
  it('GET /api/wakatime/years returns contract-valid JSON with cache headers', async () => {
    db.wakaTimeYearCache.findMany.mockResolvedValue([sampleYear]);
    const res = await call('/api/wakatime/years');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe(
      'public, s-maxage=60, stale-while-revalidate=300',
    );
    const body = wakatimeYearListSchema.parse(await res.json());
    expect(body[0].year).toBe(2024);
  });

  it('orders cached years by year desc (mirrors getCachedWakaTimeYears)', async () => {
    await call('/api/wakatime/years');
    expect(db.wakaTimeYearCache.findMany).toHaveBeenCalledWith({
      orderBy: { year: 'desc' },
    });
  });

  it('GET /api/wakatime/years/:year reads a single cached year by year', async () => {
    db.wakaTimeYearCache.findUnique.mockResolvedValue(sampleYear);
    const res = await call('/api/wakatime/years/2024');
    expect(res.status).toBe(200);
    expect(db.wakaTimeYearCache.findUnique).toHaveBeenCalledWith({
      where: { year: 2024 },
    });
    const body = wakatimeYearSchema.parse(await res.json());
    expect(body.id).toBe('year_2024');
  });

  it('returns the shared error shape when a year is not cached', async () => {
    const res = await call('/api/wakatime/years/1999');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found', code: 'NOT_FOUND' });
  });

  it('rejects a non-numeric year with a 400', async () => {
    const res = await call('/api/wakatime/years/abc');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid year', code: 'BAD_REQUEST' });
  });
});
