// WakaTime homepage section — edge-safe. Fetches the orchestrated public
// endpoint on the API service (GET /api/wakatime/stats), which composes the
// config + current/all-time/yearly stats. No Prisma / lib/wakatime here.

import { WakaTimeStatsClient } from './WakaTimeStatsClient';

interface WakaStatsResponse {
  enabled: boolean;
  config?: unknown;
  stats?: unknown;
  allTimeStats?: { totalSeconds: number; text: string } | null;
  yearlyStats?: unknown;
  yearlyStatsByYear?: Record<number, unknown>;
}

async function getWakaTimeData(): Promise<WakaStatsResponse> {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/api/wakatime/stats`, { cache: 'no-store' });
    if (!res.ok) return { enabled: false };
    return (await res.json()) as WakaStatsResponse;
  } catch {
    return { enabled: false };
  }
}

export async function WakaTimeStatsSection() {
  const data = await getWakaTimeData();
  if (!data.enabled || !data.stats) return null;

  return (
    <WakaTimeStatsClient
      stats={data.stats as never}
      allTimeStats={data.allTimeStats ?? null}
      yearlyStats={(data.yearlyStats ?? null) as never}
      yearlyStatsByYear={(data.yearlyStatsByYear ?? {}) as never}
      config={data.config as never}
    />
  );
}
