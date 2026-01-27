import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withCacheHeaders } from '@/lib/api-utils';

/**
 * GET /api/universities
 *
 * List universities with optional filters.
 * Public endpoint - no authentication required.
 *
 * Query params:
 * - q: Search query (searches in name)
 * - city: Filter by city
 * - type: Filter by type (publica, privada, politecnico)
 * - withCourses: Include course count (true/false)
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 50, max: 200)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const query = searchParams.get('q') || '';
    const city = searchParams.get('city') || undefined;
    const type = searchParams.get('type') || undefined;
    const withCourses = searchParams.get('withCourses') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50')));

    // Build where clause
    const where: Record<string, unknown> = {};

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { shortName: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    if (type) {
      where.type = type;
    }

    // Fetch universities
    const [universities, total] = await Promise.all([
      prisma.university.findMany({
        where,
        include: withCourses
          ? {
              _count: {
                select: { courses: true },
              },
            }
          : undefined,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.university.count({ where }),
    ]);

    // Get aggregations if no specific filters
    const aggregations = !query && !city && !type
      ? await Promise.all([
          prisma.university.groupBy({
            by: ['city'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 10,
          }),
          prisma.university.groupBy({
            by: ['type'],
            _count: { id: true },
          }),
        ])
      : null;

    const totalPages = Math.ceil(total / pageSize);

    const response = NextResponse.json({
      universities: universities.map((uni) => ({
        ...uni,
        coursesCount: withCourses ? (uni as typeof uni & { _count: { courses: number } })._count?.courses : undefined,
        _count: undefined,
      })),
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasMore: page < totalPages,
      },
      filters: {
        query: query || null,
        city: city || null,
        type: type || null,
      },
      ...(aggregations
        ? {
            aggregations: {
              byCity: Object.fromEntries(
                aggregations[0]
                  .filter((item) => item.city)
                  .map((item) => [item.city, item._count.id])
              ),
              byType: Object.fromEntries(
                aggregations[1]
                  .filter((item) => item.type)
                  .map((item) => [item.type, item._count.id])
              ),
            },
          }
        : {}),
    });

    // Cache for 10 minutes
    return withCacheHeaders(response, 600, 1200);
  } catch (error) {
    console.error('Universities list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch universities' },
      { status: 500 }
    );
  }
}
