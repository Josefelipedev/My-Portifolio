import { getWakaTimeStats, getWakaTimeAllTimeStats, getWakaTimeYearlyStats, getWakaTimeStatsForYear, WakaTimeStats } from '@/lib/wakatime';
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
  selectedYears: number[];
  yearlyStatsType: 'last365' | 'calendar';
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
  selectedYears: [],
  yearlyStatsType: 'last365',
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

  // Fetch base stats
  const [stats, allTimeStats] = await Promise.all([
    getWakaTimeStats(),
    getWakaTimeAllTimeStats(),
  ]);

  if (!stats) {
    return null; // Don't render if no WakaTime data
  }

  // Fetch yearly stats based on config
  let yearlyStats: WakaTimeStats | null = null;
  let yearlyStatsByYear: Record<number, WakaTimeStats> = {};

  if (config.showYearlyStats) {
    if (config.yearlyStatsType === 'calendar' && config.selectedYears.length > 0) {
      // Fetch stats for each selected year
      const yearPromises = config.selectedYears.map(async (year) => {
        const data = await getWakaTimeStatsForYear(year);
        return { year, data };
      });

      const results = await Promise.all(yearPromises);
      for (const { year, data } of results) {
        if (data) {
          yearlyStatsByYear[year] = data;
        }
      }
    } else {
      // Default to last 365 days
      yearlyStats = await getWakaTimeYearlyStats();
    }
  }

  return (
    <WakaTimeStatsClient
      stats={stats}
      allTimeStats={allTimeStats}
      yearlyStats={yearlyStats}
      yearlyStatsByYear={yearlyStatsByYear}
      config={config}
    />
  );
}
