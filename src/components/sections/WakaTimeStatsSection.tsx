import { getWakaTimeStats, getWakaTimeAllTimeStats } from '@/lib/wakatime';
import { WakaTimeStatsClient } from './WakaTimeStatsClient';

export async function WakaTimeStatsSection() {
  const [stats, allTimeStats] = await Promise.all([
    getWakaTimeStats(),
    getWakaTimeAllTimeStats(),
  ]);

  if (!stats) {
    return null; // Don't render if no WakaTime data
  }

  return <WakaTimeStatsClient stats={stats} allTimeStats={allTimeStats} />;
}
