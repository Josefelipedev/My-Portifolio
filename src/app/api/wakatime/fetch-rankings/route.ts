import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { extractRankingsFromUrls, extractRankingFromUrl } from '@/lib/wakatime-ranking';

interface WakaTimeConfig {
  yearlyReportLinks: Record<number, string>;
  yearlyRankings: Record<number, { percentile: number; totalDevs: string }>;
  [key: string]: unknown;
}

// POST - Fetch rankings from configured Year in Review URLs
export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { year, url } = body;

    // If specific year and URL provided, fetch just that one
    if (year && url) {
      const ranking = await extractRankingFromUrl(url, year);

      if (!ranking) {
        return NextResponse.json(
          { error: `Could not extract ranking for ${year}` },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        ranking,
      });
    }

    // Otherwise, fetch from all configured URLs
    // Get current config
    const result = await prisma.$queryRaw<{ wakatimeConfig: string | null }[]>`
      SELECT "wakatimeConfig" FROM "SiteConfig" WHERE id = 'main' LIMIT 1
    `;

    if (!result || result.length === 0 || !result[0].wakatimeConfig) {
      return NextResponse.json(
        { error: 'No WakaTime configuration found' },
        { status: 400 }
      );
    }

    const config: WakaTimeConfig = JSON.parse(result[0].wakatimeConfig);
    const yearlyReportLinks = config.yearlyReportLinks || {};

    if (Object.keys(yearlyReportLinks).length === 0) {
      return NextResponse.json(
        { error: 'No Year in Review URLs configured. Add URLs in the admin panel first.' },
        { status: 400 }
      );
    }

    // Extract rankings from all URLs
    const rankings = await extractRankingsFromUrls(yearlyReportLinks);

    if (Object.keys(rankings).length === 0) {
      return NextResponse.json(
        { error: 'Could not extract rankings from any URL' },
        { status: 400 }
      );
    }

    // Convert to the format expected by yearlyRankings
    const yearlyRankings: Record<number, { percentile: number; totalDevs: string }> = {};
    for (const [yearStr, ranking] of Object.entries(rankings)) {
      const yr = parseInt(yearStr, 10);
      yearlyRankings[yr] = {
        percentile: ranking.percentile,
        totalDevs: ranking.totalDevs,
      };
    }

    // Merge with existing rankings (don't overwrite if extraction failed)
    const mergedRankings = {
      ...config.yearlyRankings,
      ...yearlyRankings,
    };

    // Update config with new rankings
    const updatedConfig = {
      ...config,
      yearlyRankings: mergedRankings,
    };

    const configJson = JSON.stringify(updatedConfig);

    await prisma.$executeRaw`
      UPDATE "SiteConfig" SET "wakatimeConfig" = ${configJson} WHERE id = 'main'
    `;

    return NextResponse.json({
      success: true,
      message: `Successfully extracted rankings for ${Object.keys(rankings).length} year(s)`,
      rankings: yearlyRankings,
      details: rankings,
    });
  } catch (error) {
    console.error('Fetch rankings error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch rankings' },
      { status: 500 }
    );
  }
}
