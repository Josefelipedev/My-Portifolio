import { getWakaTimeStats, getWakaTimeAllTimeStats, getWakaTimeYearlyStats, getWakaTimeStatsForYear, WakaTimeStats } from '@/lib/wakatime';
import { WakaTimeStatsClient } from './WakaTimeStatsClient';
import prisma from '@/lib/prisma';

export interface WakaTimeConfig {
  enabled: boolean;
  // Weekly stats (last 7 days)
  showTotalTime: boolean;
  showDailyAverage: boolean;
  showBestDay: boolean;
  showAllTime: boolean;
  showLanguages: boolean;
  showEditors: boolean;
  showOS: boolean;
  showProjects: boolean;
  // Yearly stats section
  showYearlyStats: boolean;
  showYearSelector: boolean;
  selectedYears: number[];
  yearlyStatsType: 'last365' | 'calendar';
  // Yearly display options
  showYearlyTotalTime: boolean;
  showYearlyDailyAverage: boolean;
  showYearlyBestDay: boolean;
  showYearlyLanguages: boolean;
  showYearlyEditors: boolean;
  showYearlyOS: boolean;
  showYearlyProjects: boolean;
  // Other
  profileUrl: string;
  cacheYearlyData: boolean;
}

const DEFAULT_CONFIG: WakaTimeConfig = {
  enabled: true,
  showTotalTime: true,
  showDailyAverage: true,
  showBestDay: true,
  showAllTime: true,
  showLanguages: true,
  showEditors: true,
  showOS: true,
  showProjects: true,
  showYearlyStats: true,
  showYearSelector: true,
  selectedYears: [],
  yearlyStatsType: 'last365',
  showYearlyTotalTime: true,
  showYearlyDailyAverage: true,
  showYearlyBestDay: true,
  showYearlyLanguages: true,
  showYearlyEditors: true,
  showYearlyOS: true,
  showYearlyProjects: true,
  profileUrl: 'https://wakatime.com/@josefelipedev',
  cacheYearlyData: true,
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
