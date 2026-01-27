import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withCacheHeaders } from '@/lib/api-utils';

/**
 * GET /api/courses/search
 *
 * Search courses with filters.
 * Public endpoint - no authentication required.
 *
 * Query params:
 * - q: Search query (searches in name and description)
 * - level: Filter by course level (graduacao, mestrado, doutorado, etc.)
 * - university: Filter by university ID
 * - city: Filter by city
 * - modality: Filter by modality (presencial, online, hibrido)
 * - area: Filter by area of study
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const query = searchParams.get('q') || '';
    const level = searchParams.get('level') || undefined;
    const university = searchParams.get('university') || undefined;
    const city = searchParams.get('city') || undefined;
    const modality = searchParams.get('modality') || undefined;
    const area = searchParams.get('area') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));

    // Build where clause
    const where: Record<string, unknown> = {};

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { tags: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (level) {
      where.level = level;
    }

    if (university) {
      where.universityId = university;
    }

    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    if (modality) {
      where.modality = modality;
    }

    if (area) {
      where.area = { contains: area, mode: 'insensitive' };
    }

    // Fetch courses with pagination
    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: {
          university: {
            select: {
              id: true,
              name: true,
              shortName: true,
              slug: true,
              city: true,
              logoUrl: true,
              website: true,
              type: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.course.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    const response = NextResponse.json({
      courses,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasMore: page < totalPages,
        hasPrevious: page > 1,
      },
      filters: {
        query: query || null,
        level: level || null,
        university: university || null,
        city: city || null,
        modality: modality || null,
        area: area || null,
      },
    });

    // Cache for 5 minutes, stale-while-revalidate for 10 minutes
    return withCacheHeaders(response, 300, 600);
  } catch (error) {
    console.error('Course search error:', error);
    return NextResponse.json(
      { error: 'Failed to search courses' },
      { status: 500 }
    );
  }
}
