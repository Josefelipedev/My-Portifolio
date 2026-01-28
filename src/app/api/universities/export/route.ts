import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/universities/export
 *
 * Export universities data in JSON or CSV format.
 * Public endpoint for data portability.
 *
 * Query params:
 * - format: "json" | "csv" (default: "json")
 * - city: Filter by city
 * - type: Filter by type (publica, privada, politecnico)
 * - withCourses: Include courses count (true/false)
 * - all: Export all universities without filters (true/false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const format = searchParams.get('format') || 'json';
    const city = searchParams.get('city');
    const type = searchParams.get('type');
    const withCourses = searchParams.get('withCourses') !== 'false';
    const exportAll = searchParams.get('all') === 'true';

    // Build where clause
    const where: Record<string, unknown> = {};

    if (!exportAll) {
      if (city) {
        where.city = { contains: city, mode: 'insensitive' };
      }

      if (type) {
        where.type = type;
      }
    }

    // Fetch universities with course count
    const universities = await prisma.university.findMany({
      where,
      include: withCourses
        ? {
            _count: {
              select: { courses: true },
            },
          }
        : undefined,
      orderBy: { name: 'asc' },
    });

    // Get aggregations
    const [byCity, byType] = await Promise.all([
      prisma.university.groupBy({
        by: ['city'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.university.groupBy({
        by: ['type'],
        where,
        _count: { id: true },
      }),
    ]);

    // Format timestamp
    const exportedAt = new Date().toISOString();

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'id',
        'name',
        'shortName',
        'website',
        'sourceUrl',
        'city',
        'region',
        'country',
        'address',
        'email',
        'phone',
        'type',
        'instagramUrl',
        'linkedinUrl',
        'facebookUrl',
        'twitterUrl',
        'youtubeUrl',
        'coursesCount',
      ];

      const csvRows = [headers.join(',')];

      for (const uni of universities) {
        const coursesCount = withCourses
          ? (uni as typeof uni & { _count: { courses: number } })._count?.courses || 0
          : '';

        const row = [
          uni.id,
          `"${(uni.name || '').replace(/"/g, '""')}"`,
          uni.shortName || '',
          uni.website || '',
          uni.sourceUrl,
          uni.city || '',
          uni.region || '',
          uni.country,
          `"${(uni.address || '').replace(/"/g, '""')}"`,
          uni.email || '',
          uni.phone || '',
          uni.type || '',
          uni.instagramUrl || '',
          uni.linkedinUrl || '',
          uni.facebookUrl || '',
          uni.twitterUrl || '',
          uni.youtubeUrl || '',
          coursesCount,
        ];
        csvRows.push(row.join(','));
      }

      const csv = csvRows.join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="universities-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // JSON format
    return NextResponse.json({
      exportedAt,
      totalUniversities: universities.length,
      universities: universities.map((uni) => ({
        id: uni.id,
        name: uni.name,
        shortName: uni.shortName,
        slug: uni.slug,
        description: uni.description,
        website: uni.website,
        sourceUrl: uni.sourceUrl,
        city: uni.city,
        region: uni.region,
        country: uni.country,
        address: uni.address,
        logoUrl: uni.logoUrl,
        email: uni.email,
        phone: uni.phone,
        type: uni.type,
        // Redes sociais
        instagramUrl: uni.instagramUrl,
        linkedinUrl: uni.linkedinUrl,
        facebookUrl: uni.facebookUrl,
        twitterUrl: uni.twitterUrl,
        youtubeUrl: uni.youtubeUrl,
        // Enriquecimento
        enrichedAt: uni.enrichedAt,
        coursesCount: withCourses
          ? (uni as typeof uni & { _count: { courses: number } })._count?.courses
          : undefined,
      })),
      aggregations: {
        byCity: Object.fromEntries(
          byCity
            .filter((item) => item.city)
            .map((item) => [item.city, item._count.id])
        ),
        byType: Object.fromEntries(
          byType
            .filter((item) => item.type)
            .map((item) => [item.type, item._count.id])
        ),
      },
      filters: {
        city: city || null,
        type: type || null,
      },
    });
  } catch (error) {
    console.error('Universities export error:', error);
    return NextResponse.json({ error: 'Failed to export universities' }, { status: 500 });
  }
}
