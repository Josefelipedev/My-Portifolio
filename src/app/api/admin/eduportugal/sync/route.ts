import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { logger } from '@/lib/logger';

const SCRAPER_URL = process.env.PYTHON_SCRAPER_URL || 'http://localhost:8000';

interface UniversityData {
  id: string;
  name: string;
  slug: string;
  short_name?: string;
  description?: string;
  website?: string;
  source_url: string;
  city?: string;
  region?: string;
  address?: string;
  logo_url?: string;
  email?: string;
  phone?: string;
  type?: string;
}

interface CourseData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  level: string;
  area?: string;
  sub_area?: string;
  duration?: string;
  duration_months?: number;
  credits?: number;
  modality?: string;
  schedule?: string;
  language?: string;
  city?: string;
  campus?: string;
  start_date?: string;
  application_deadline?: string;
  price?: string;
  source_url: string;
  official_url?: string;
  application_url?: string;
  tags?: string;
  university_name?: string;
  university_slug?: string;
}

/**
 * POST /api/admin/eduportugal/sync
 *
 * Import data from EduPortugal (one-time import).
 * Use this to initially populate the database, then manage manually.
 *
 * Body:
 * - syncType: "full" | "universities" | "courses" (default: "full")
 * - maxPages: number - Limit pages per level (optional, for testing)
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { syncType = 'full', maxPages } = body;

    // Create sync log entry
    const syncLog = await prisma.eduPortugalSyncLog.create({
      data: {
        syncType,
        status: 'running',
      },
    });

    logger.info('eduportugal', `Starting initial import: ${syncType}`, { syncId: syncLog.id });

    // Start async import process (don't await)
    importInBackground(syncLog.id, syncType, maxPages);

    return NextResponse.json({
      success: true,
      syncId: syncLog.id,
      message: `Import started: ${syncType}`,
      checkStatusUrl: `/api/admin/eduportugal/status?syncId=${syncLog.id}`,
    });
  } catch (error) {
    logger.error('eduportugal', 'Failed to start import', { error: String(error) });
    return NextResponse.json({ error: 'Failed to start import' }, { status: 500 });
  }
}

/**
 * Background import function
 */
async function importInBackground(
  syncId: string,
  syncType: string,
  maxPages?: number
) {
  try {
    let universitiesData: UniversityData[] = [];
    let coursesData: CourseData[] = [];
    let universitiesCreated = 0;
    let universitiesUpdated = 0;
    let coursesCreated = 0;
    let coursesUpdated = 0;

    // Import universities
    if (syncType === 'full' || syncType === 'universities') {
      logger.info('eduportugal', 'Importing universities...');

      const url = new URL(`${SCRAPER_URL}/eduportugal/universities`);
      url.searchParams.set('sync_id', syncId);
      if (maxPages) url.searchParams.set('max_pages', String(maxPages));

      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(600000), // 10 min timeout
      });

      if (response.ok) {
        const data = await response.json();
        universitiesData = data.universities || [];

        // Upsert universities
        for (const uni of universitiesData) {
          const existing = await prisma.university.findUnique({
            where: { externalId: uni.id },
          });

          if (existing) {
            await prisma.university.update({
              where: { externalId: uni.id },
              data: {
                name: uni.name,
                shortName: uni.short_name,
                description: uni.description,
                website: uni.website,
                city: uni.city,
                region: uni.region,
                address: uni.address,
                logoUrl: uni.logo_url,
                email: uni.email,
                phone: uni.phone,
                type: uni.type,
              },
            });
            universitiesUpdated++;
          } else {
            await prisma.university.create({
              data: {
                externalId: uni.id,
                name: uni.name,
                slug: uni.slug,
                shortName: uni.short_name,
                description: uni.description,
                website: uni.website,
                sourceUrl: uni.source_url,
                city: uni.city,
                region: uni.region,
                address: uni.address,
                logoUrl: uni.logo_url,
                email: uni.email,
                phone: uni.phone,
                type: uni.type,
              },
            });
            universitiesCreated++;
          }
        }

        await prisma.eduPortugalSyncLog.update({
          where: { id: syncId },
          data: {
            universitiesFound: universitiesData.length,
            universitiesCreated,
            universitiesUpdated,
          },
        });

        logger.info('eduportugal', `Universities imported: ${universitiesData.length}`, {
          created: universitiesCreated,
          updated: universitiesUpdated,
        });
      } else {
        logger.error('eduportugal', `Failed to fetch universities: ${response.status}`);
      }
    }

    // Import courses
    if (syncType === 'full' || syncType === 'courses') {
      logger.info('eduportugal', 'Importing courses...');

      const url = new URL(`${SCRAPER_URL}/eduportugal/courses`);
      url.searchParams.set('sync_id', syncId);
      if (maxPages) url.searchParams.set('max_pages', String(maxPages));

      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(1800000), // 30 min timeout for courses
      });

      if (response.ok) {
        const data = await response.json();
        coursesData = data.courses || [];

        // Get university ID map
        const universities = await prisma.university.findMany({
          select: { id: true, externalId: true, slug: true, name: true },
        });

        const uniBySlug = new Map(universities.map((u) => [u.slug, u.id]));
        const uniByName = new Map(universities.map((u) => [u.name.toLowerCase(), u.id]));

        // Upsert courses
        for (const course of coursesData) {
          // Find university ID
          let universityId = uniBySlug.get(course.university_slug || '');

          if (!universityId && course.university_name) {
            universityId = uniByName.get(course.university_name.toLowerCase());
          }

          if (!universityId) {
            // Try partial match
            const partialMatch = universities.find(
              (u) =>
                course.university_slug?.includes(u.slug) ||
                u.slug.includes(course.university_slug || '') ||
                u.name.toLowerCase().includes(course.university_name?.toLowerCase() || '')
            );
            universityId = partialMatch?.id;
          }

          if (!universityId) {
            logger.warn('eduportugal', `University not found for course: ${course.name}`, {
              university_slug: course.university_slug,
              university_name: course.university_name,
            });
            continue;
          }

          const existing = await prisma.course.findUnique({
            where: { externalId: course.id },
          });

          const courseData = {
            name: course.name,
            slug: course.slug,
            description: course.description,
            level: course.level,
            area: course.area,
            subArea: course.sub_area,
            duration: course.duration,
            durationMonths: course.duration_months,
            credits: course.credits,
            modality: course.modality,
            schedule: course.schedule,
            language: course.language,
            city: course.city,
            campus: course.campus,
            startDate: course.start_date,
            applicationDeadline: course.application_deadline,
            price: course.price,
            sourceUrl: course.source_url,
            officialUrl: course.official_url,
            applicationUrl: course.application_url,
            tags: course.tags,
            universityId,
          };

          if (existing) {
            await prisma.course.update({
              where: { externalId: course.id },
              data: courseData,
            });
            coursesUpdated++;
          } else {
            await prisma.course.create({
              data: {
                externalId: course.id,
                ...courseData,
              },
            });
            coursesCreated++;
          }
        }

        await prisma.eduPortugalSyncLog.update({
          where: { id: syncId },
          data: {
            coursesFound: coursesData.length,
            coursesCreated,
            coursesUpdated,
          },
        });

        logger.info('eduportugal', `Courses imported: ${coursesData.length}`, {
          created: coursesCreated,
          updated: coursesUpdated,
        });
      } else {
        logger.error('eduportugal', `Failed to fetch courses: ${response.status}`);
      }
    }

    // Mark import as completed
    await prisma.eduPortugalSyncLog.update({
      where: { id: syncId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    logger.info('eduportugal', `Import completed`, {
      syncId,
      universities: universitiesData.length,
      courses: coursesData.length,
    });
  } catch (error) {
    logger.error('eduportugal', `Import failed`, { syncId, error: String(error) });

    await prisma.eduPortugalSyncLog.update({
      where: { id: syncId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errors: JSON.stringify([String(error)]),
      },
    });
  }
}

/**
 * GET /api/admin/eduportugal/sync
 *
 * Get import history.
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '10'));

    const [syncs, stats] = await Promise.all([
      prisma.eduPortugalSyncLog.findMany({
        orderBy: { startedAt: 'desc' },
        take: limit,
      }),
      Promise.all([
        prisma.university.count(),
        prisma.course.count(),
        prisma.course.groupBy({
          by: ['level'],
          _count: { id: true },
        }),
      ]),
    ]);

    return NextResponse.json({
      syncs,
      stats: {
        totalUniversities: stats[0],
        totalCourses: stats[1],
        coursesByLevel: Object.fromEntries(
          stats[2].map((item) => [item.level, item._count.id])
        ),
      },
    });
  } catch (error) {
    console.error('Import history error:', error);
    return NextResponse.json({ error: 'Failed to fetch import history' }, { status: 500 });
  }
}
