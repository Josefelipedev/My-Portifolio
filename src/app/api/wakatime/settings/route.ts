import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { error } from '@/lib/api-utils';

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
  selectedYears: number[]; // Years to display (e.g., [2024, 2023])
  yearlyStatsType: 'last365' | 'calendar'; // 'last365' = last 365 days, 'calendar' = specific years
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
      showYearlyStats: typeof body.showYearlyStats === 'boolean' ? body.showYearlyStats : DEFAULT_CONFIG.showYearlyStats,
      showLanguages: typeof body.showLanguages === 'boolean' ? body.showLanguages : DEFAULT_CONFIG.showLanguages,
      showEditors: typeof body.showEditors === 'boolean' ? body.showEditors : DEFAULT_CONFIG.showEditors,
      showOS: typeof body.showOS === 'boolean' ? body.showOS : DEFAULT_CONFIG.showOS,
      showProjects: typeof body.showProjects === 'boolean' ? body.showProjects : DEFAULT_CONFIG.showProjects,
      profileUrl: typeof body.profileUrl === 'string' ? body.profileUrl : DEFAULT_CONFIG.profileUrl,
      selectedYears: Array.isArray(body.selectedYears) ? body.selectedYears.filter((y: unknown) => typeof y === 'number') : DEFAULT_CONFIG.selectedYears,
      yearlyStatsType: body.yearlyStatsType === 'calendar' ? 'calendar' : 'last365',
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
