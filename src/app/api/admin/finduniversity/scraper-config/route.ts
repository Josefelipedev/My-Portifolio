import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';

/**
 * Extract only the origin (protocol + domain) from a URL.
 * This prevents users from accidentally including paths that would cause duplication.
 * Example: "https://www.dges.gov.pt/guias/indest.asp" -> "https://www.dges.gov.pt"
 */
function extractBaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin; // Returns "https://www.dges.gov.pt"
  } catch {
    // If URL parsing fails, just remove trailing slash
    return url.replace(/\/$/, '');
  }
}

const DEFAULT_CONFIG = {
  dgesBaseUrl: 'https://www.dges.gov.pt',
  dgesEnabled: true,
  eduportugalBaseUrl: 'https://eduportugal.eu',
  eduportugalEnabled: true,
};

/**
 * GET /api/admin/finduniversity/scraper-config
 *
 * Get current scraper configuration.
 * Requires authentication.
 */
export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let config = await prisma.scraperConfig.findUnique({
      where: { id: 'main' },
    });

    // Create default config if it doesn't exist
    if (!config) {
      config = await prisma.scraperConfig.create({
        data: {
          id: 'main',
          ...DEFAULT_CONFIG,
        },
      });
    }

    return NextResponse.json({
      config: {
        dges: {
          baseUrl: config.dgesBaseUrl,
          enabled: config.dgesEnabled,
        },
        eduportugal: {
          baseUrl: config.eduportugalBaseUrl,
          enabled: config.eduportugalEnabled,
        },
      },
      updatedAt: config.updatedAt,
    });
  } catch (error) {
    console.error('Get scraper config error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scraper configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/finduniversity/scraper-config
 *
 * Update scraper configuration.
 * Requires authentication.
 */
export async function PUT(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { dges, eduportugal } = body;

    // Validate URLs
    const urlRegex = /^https?:\/\/.+/;

    if (dges?.baseUrl && !urlRegex.test(dges.baseUrl)) {
      return NextResponse.json(
        { error: 'Invalid DGES URL format' },
        { status: 400 }
      );
    }

    if (eduportugal?.baseUrl && !urlRegex.test(eduportugal.baseUrl)) {
      return NextResponse.json(
        { error: 'Invalid EduPortugal URL format' },
        { status: 400 }
      );
    }

    const updateData: Record<string, string | boolean> = {};

    if (dges?.baseUrl !== undefined) {
      // Extract only origin to prevent path duplication issues
      updateData.dgesBaseUrl = extractBaseUrl(dges.baseUrl);
    }
    if (dges?.enabled !== undefined) {
      updateData.dgesEnabled = dges.enabled;
    }
    if (eduportugal?.baseUrl !== undefined) {
      // Extract only origin to prevent path duplication issues
      updateData.eduportugalBaseUrl = extractBaseUrl(eduportugal.baseUrl);
    }
    if (eduportugal?.enabled !== undefined) {
      updateData.eduportugalEnabled = eduportugal.enabled;
    }

    const config = await prisma.scraperConfig.upsert({
      where: { id: 'main' },
      update: updateData,
      create: {
        id: 'main',
        ...DEFAULT_CONFIG,
        ...updateData,
      },
    });

    return NextResponse.json({
      success: true,
      config: {
        dges: {
          baseUrl: config.dgesBaseUrl,
          enabled: config.dgesEnabled,
        },
        eduportugal: {
          baseUrl: config.eduportugalBaseUrl,
          enabled: config.eduportugalEnabled,
        },
      },
      updatedAt: config.updatedAt,
    });
  } catch (error) {
    console.error('Update scraper config error:', error);
    return NextResponse.json(
      { error: 'Failed to update scraper configuration' },
      { status: 500 }
    );
  }
}
