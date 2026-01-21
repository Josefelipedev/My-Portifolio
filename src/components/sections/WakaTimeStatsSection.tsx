import { getWakaTimeStats, getWakaTimeAllTimeStats, getWakaTimeYearlyStats } from '@/lib/wakatime';
import { WakaTimeStatsClient } from './WakaTimeStatsClient';
import prisma from '@/lib/prisma';

export interface WakaTimeConfig {
  enabled: boolean;
  showTotalTime: boolean;
  showDailyAverage: boolean;
  showBestDay: boolean;
  showAllTime: boolean;
  showYearlyStats: boolean;
  showLanguages: boolean;
  showEditors: boolean;
  showOS: boolean;
  showProjects: boolean;
  profileUrl: string;
}

const DEFAULT_CONFIG: WakaTimeConfig = {
  enabled: true,
  showTotalTime: true,
  showDailyAverage: true,
  showBestDay: true,
  showAllTime: true,
  showYearlyStats: true,
  showLanguages: true,
  showEditors: true,
  showOS: true,
  showProjects: true,
  profileUrl: 'https://wakatime.com/@josefelipe',
};

async function getWakaTimeConfig(): Promise<WakaTimeConfig> {
  try {
    // First check if the column exists by attempting a simple query
    const result = await prisma.$queryRawUnsafe<{ wakatimeConfig: string | null }[]>(
      `SELECT "wakatimeConfig" FROM "SiteConfig" WHERE id = 'main' LIMIT 1`
    );

    if (!result || result.length === 0 || !result[0].wakatimeConfig) {
      return DEFAULT_CONFIG;
    }

    const parsed = JSON.parse(result[0].wakatimeConfig) as WakaTimeConfig;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (error) {
    // Column might not exist yet or other error - return defaults silently
    console.log('WakaTime config not available, using defaults');
    return DEFAULT_CONFIG;
  }
}

export async function WakaTimeStatsSection() {
  const config = await getWakaTimeConfig();

  // If section is disabled, don't render anything
  if (!config.enabled) {
    return null;
  }

  const [stats, allTimeStats, yearlyStats] = await Promise.all([
    getWakaTimeStats(),
    getWakaTimeAllTimeStats(),
    config.showYearlyStats ? getWakaTimeYearlyStats() : Promise.resolve(null),
  ]);

  if (!stats) {
    return null; // Don't render if no WakaTime data
  }

  return <WakaTimeStatsClient stats={stats} allTimeStats={allTimeStats} yearlyStats={yearlyStats} config={config} />;
}
