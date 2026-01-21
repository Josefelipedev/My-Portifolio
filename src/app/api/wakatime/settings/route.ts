import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { error } from '@/lib/api-utils';

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
  cacheYearlyData: boolean; // Save yearly data in database
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

// GET - Fetch WakaTime settings (public for frontend)
export async function GET() {
  try {
    // Use raw query to handle case when column doesn't exist yet
    const result = await prisma.$queryRaw<{ wakatimeConfig: string | null }[]>`
      SELECT "wakatimeConfig" FROM "SiteConfig" WHERE id = 'main' LIMIT 1
    `;

    if (!result || result.length === 0 || !result[0].wakatimeConfig) {
      return NextResponse.json(DEFAULT_CONFIG);
    }

    try {
      const parsed = JSON.parse(result[0].wakatimeConfig) as WakaTimeConfig;
      return NextResponse.json({ ...DEFAULT_CONFIG, ...parsed });
    } catch {
      return NextResponse.json(DEFAULT_CONFIG);
    }
  } catch {
    // Column might not exist yet - return defaults
    return NextResponse.json(DEFAULT_CONFIG);
  }
}

// PUT - Update WakaTime settings (admin only)
export async function PUT(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate and sanitize the config
    const newConfig: WakaTimeConfig = {
      enabled: typeof body.enabled === 'boolean' ? body.enabled : DEFAULT_CONFIG.enabled,
      showTotalTime: typeof body.showTotalTime === 'boolean' ? body.showTotalTime : DEFAULT_CONFIG.showTotalTime,
      showDailyAverage: typeof body.showDailyAverage === 'boolean' ? body.showDailyAverage : DEFAULT_CONFIG.showDailyAverage,
      showBestDay: typeof body.showBestDay === 'boolean' ? body.showBestDay : DEFAULT_CONFIG.showBestDay,
      showAllTime: typeof body.showAllTime === 'boolean' ? body.showAllTime : DEFAULT_CONFIG.showAllTime,
      showLanguages: typeof body.showLanguages === 'boolean' ? body.showLanguages : DEFAULT_CONFIG.showLanguages,
      showEditors: typeof body.showEditors === 'boolean' ? body.showEditors : DEFAULT_CONFIG.showEditors,
      showOS: typeof body.showOS === 'boolean' ? body.showOS : DEFAULT_CONFIG.showOS,
      showProjects: typeof body.showProjects === 'boolean' ? body.showProjects : DEFAULT_CONFIG.showProjects,
      showYearlyStats: typeof body.showYearlyStats === 'boolean' ? body.showYearlyStats : DEFAULT_CONFIG.showYearlyStats,
      showYearSelector: typeof body.showYearSelector === 'boolean' ? body.showYearSelector : DEFAULT_CONFIG.showYearSelector,
      selectedYears: Array.isArray(body.selectedYears) ? body.selectedYears.filter((y: unknown) => typeof y === 'number') : DEFAULT_CONFIG.selectedYears,
      yearlyStatsType: body.yearlyStatsType === 'calendar' ? 'calendar' : 'last365',
      showYearlyTotalTime: typeof body.showYearlyTotalTime === 'boolean' ? body.showYearlyTotalTime : DEFAULT_CONFIG.showYearlyTotalTime,
      showYearlyDailyAverage: typeof body.showYearlyDailyAverage === 'boolean' ? body.showYearlyDailyAverage : DEFAULT_CONFIG.showYearlyDailyAverage,
      showYearlyBestDay: typeof body.showYearlyBestDay === 'boolean' ? body.showYearlyBestDay : DEFAULT_CONFIG.showYearlyBestDay,
      showYearlyLanguages: typeof body.showYearlyLanguages === 'boolean' ? body.showYearlyLanguages : DEFAULT_CONFIG.showYearlyLanguages,
      showYearlyEditors: typeof body.showYearlyEditors === 'boolean' ? body.showYearlyEditors : DEFAULT_CONFIG.showYearlyEditors,
      showYearlyOS: typeof body.showYearlyOS === 'boolean' ? body.showYearlyOS : DEFAULT_CONFIG.showYearlyOS,
      showYearlyProjects: typeof body.showYearlyProjects === 'boolean' ? body.showYearlyProjects : DEFAULT_CONFIG.showYearlyProjects,
      profileUrl: typeof body.profileUrl === 'string' ? body.profileUrl : DEFAULT_CONFIG.profileUrl,
      cacheYearlyData: typeof body.cacheYearlyData === 'boolean' ? body.cacheYearlyData : DEFAULT_CONFIG.cacheYearlyData,
    };

    const configJson = JSON.stringify(newConfig);

    // Try to update/insert using raw query to handle schema differences
    try {
      await prisma.$executeRaw`
        INSERT INTO "SiteConfig" (id, "wakatimeConfig")
        VALUES ('main', ${configJson})
        ON CONFLICT (id) DO UPDATE SET "wakatimeConfig" = ${configJson}
      `;
    } catch {
      // If column doesn't exist, the admin needs to run migration
      return NextResponse.json(
        { error: 'Database migration required. Run: npx prisma db push' },
        { status: 500 }
      );
    }

    return NextResponse.json(newConfig);
  } catch (err) {
    return error(err);
  }
}
