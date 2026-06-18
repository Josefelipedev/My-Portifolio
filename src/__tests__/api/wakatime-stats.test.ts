// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  siteConfig: { findUnique: vi.fn() },
  wakaTimeYearCache: { findMany: vi.fn(), findUnique: vi.fn() },
  session: { findFirst: vi.fn() },
  project: { findMany: vi.fn() }, experience: { findMany: vi.fn() }, skill: { findMany: vi.fn() },
  education: { findMany: vi.fn() }, contactMessage: { create: vi.fn() },
}));
const waka = vi.hoisted(() => ({
  getWakaTimeStats: vi.fn(),
  getWakaTimeAllTimeStats: vi.fn(),
  getWakaTimeYearlyStats: vi.fn(),
  getWakaTimeStatsForYear: vi.fn(),
}));
vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/wakatime', () => waka);
vi.mock('../../../apps/api/src/lib/email', () => ({ sendContactNotification: vi.fn() }));
vi.mock('../../../apps/api/src/lib/claude', () => ({
  generateSkillsSuggestion: vi.fn(), analyzeReadmeForProject: vi.fn(), analyzeResumePDF: vi.fn(),
  getCurrentAIProvider: vi.fn(() => ({ provider: 'together', model: 'm' })),
}));

import app from '../../../apps/api/src/app';

const get = (p: string) => app.fetch(new Request(`http://local${p}`));

beforeEach(() => {
  vi.clearAllMocks();
  db.siteConfig.findUnique.mockResolvedValue({ wakatimeConfig: null }); // -> DEFAULT_CONFIG (enabled, last365)
});

describe('GET /api/wakatime/stats', () => {
  it('composes config + stats + all-time + yearly (last365)', async () => {
    waka.getWakaTimeStats.mockResolvedValue({ totalSeconds: 100, dailyAverage: '1h' });
    waka.getWakaTimeAllTimeStats.mockResolvedValue({ totalSeconds: 9999, text: '2 hrs' });
    waka.getWakaTimeYearlyStats.mockResolvedValue({ totalSeconds: 5000 });

    const res = await get('/api/wakatime/stats');
    expect(res.status).toBe(200);
    const json = (await res.json()) as { enabled: boolean; stats: unknown; allTimeStats: unknown; yearlyStats: unknown };
    expect(json.enabled).toBe(true);
    expect(json.stats).toMatchObject({ totalSeconds: 100 });
    expect(json.allTimeStats).toMatchObject({ totalSeconds: 9999 });
    expect(json.yearlyStats).toMatchObject({ totalSeconds: 5000 });
    expect(waka.getWakaTimeStatsForYear).not.toHaveBeenCalled(); // last365 path
  });

  it('returns {enabled:false} when disabled in config', async () => {
    db.siteConfig.findUnique.mockResolvedValue({ wakatimeConfig: JSON.stringify({ enabled: false }) });
    const res = await get('/api/wakatime/stats');
    expect(await res.json()).toEqual({ enabled: false });
    expect(waka.getWakaTimeStats).not.toHaveBeenCalled();
  });

  it('returns {enabled:false} when there are no current stats', async () => {
    waka.getWakaTimeStats.mockResolvedValue(null);
    waka.getWakaTimeAllTimeStats.mockResolvedValue(null);
    const res = await get('/api/wakatime/stats');
    expect(await res.json()).toEqual({ enabled: false });
  });

  it('fetches per-year stats in calendar mode', async () => {
    db.siteConfig.findUnique.mockResolvedValue({
      wakatimeConfig: JSON.stringify({ yearlyStatsType: 'calendar', selectedYears: [2024, 2025] }),
    });
    waka.getWakaTimeStats.mockResolvedValue({ totalSeconds: 1 });
    waka.getWakaTimeAllTimeStats.mockResolvedValue(null);
    waka.getWakaTimeStatsForYear.mockImplementation(async (y: number) => ({ year: y, totalSeconds: y }));

    const res = await get('/api/wakatime/stats');
    const json = (await res.json()) as { yearlyStatsByYear: Record<string, { totalSeconds: number }> };
    expect(Object.keys(json.yearlyStatsByYear)).toEqual(['2024', '2025']);
    expect(waka.getWakaTimeStatsForYear).toHaveBeenCalledTimes(2);
  });
});
