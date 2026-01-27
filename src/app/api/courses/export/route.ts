import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/courses/export
 *
 * Export courses data in JSON or CSV format.
 * Public endpoint for data portability.
 *
 * Query params:
 * - format: "json" | "csv" (default: "json")
 * - level: Filter by course level (comma-separated for multiple)
 * - city: Filter by city
 * - area: Filter by area of study
 * - university: Filter by university ID
 * - grouped: Group by level (true/false, only for JSON)
 * - all: Export all courses without filters (true/false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const format = searchParams.get('format') || 'json';
    const levelFilter = searchParams.get('level');
    const city = searchParams.get('city');
    const area = searchParams.get('area');
    const university = searchParams.get('university');
    const grouped = searchParams.get('grouped') === 'true';
    const exportAll = searchParams.get('all') === 'true';

    // Build where clause
    const where: Record<string, unknown> = {};

    if (!exportAll) {
      if (levelFilter) {
        const levels = levelFilter.split(',').map((l) => l.trim());
        if (levels.length === 1) {
          where.level = levels[0];
        } else {
          where.level = { in: levels };
        }
      }

      if (city) {
        where.city = { contains: city, mode: 'insensitive' };
      }

      if (area) {
        where.area = { contains: area, mode: 'insensitive' };
      }

      if (university) {
        where.universityId = university;
      }
    }

    // Fetch courses with university data
    const courses = await prisma.course.findMany({
      where,
      include: {
        university: {
          select: {
            id: true,
            name: true,
            shortName: true,
            city: true,
            type: true,
            website: true,
          },
        },
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });

    // Format timestamp
    const exportedAt = new Date().toISOString();

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'id',
        'name',
        'level',
        'area',
        'subArea',
        'duration',
        'durationMonths',
        'credits',
        'modality',
        'schedule',
        'language',
        'city',
        'campus',
        'startDate',
        'applicationDeadline',
        'price',
        'sourceUrl',
        'officialUrl',
        'applicationUrl',
        'tags',
        'universityName',
        'universityShortName',
        'universityCity',
        'universityType',
        'universityWebsite',
      ];

      const csvRows = [headers.join(',')];

      for (const course of courses) {
        const row = [
          course.id,
          `"${(course.name || '').replace(/"/g, '""')}"`,
          course.level,
          course.area || '',
          course.subArea || '',
          course.duration || '',
          course.durationMonths || '',
          course.credits || '',
          course.modality || '',
          course.schedule || '',
          course.language || '',
          course.city || '',
          course.campus || '',
          course.startDate || '',
          course.applicationDeadline || '',
          `"${(course.price || '').replace(/"/g, '""')}"`,
          course.sourceUrl,
          course.officialUrl || '',
          course.applicationUrl || '',
          `"${(course.tags || '').replace(/"/g, '""')}"`,
          `"${(course.university.name || '').replace(/"/g, '""')}"`,
          course.university.shortName || '',
          course.university.city || '',
          course.university.type || '',
          course.university.website || '',
        ];
        csvRows.push(row.join(','));
      }

      const csv = csvRows.join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="courses-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // JSON format
    if (grouped) {
      // Group courses by level
      const coursesByLevel: Record<string, { count: number; courses: typeof courses }> = {};

      for (const course of courses) {
        if (!coursesByLevel[course.level]) {
          coursesByLevel[course.level] = { count: 0, courses: [] };
        }
        coursesByLevel[course.level].courses.push(course);
        coursesByLevel[course.level].count++;
      }

      return NextResponse.json({
        exportedAt,
        totalCourses: courses.length,
        levelsCount: Object.keys(coursesByLevel).length,
        categories: coursesByLevel,
        filters: {
          level: levelFilter || 'all',
          city: city || null,
          area: area || null,
          university: university || null,
        },
      });
    }

    // Flat JSON
    return NextResponse.json({
      exportedAt,
      totalCourses: courses.length,
      courses: courses.map((course) => ({
        id: course.id,
        name: course.name,
        slug: course.slug,
        description: course.description,
        level: course.level,
        area: course.area,
        subArea: course.subArea,
        duration: course.duration,
        durationMonths: course.durationMonths,
        credits: course.credits,
        modality: course.modality,
        schedule: course.schedule,
        language: course.language,
        city: course.city,
        campus: course.campus,
        startDate: course.startDate,
        applicationDeadline: course.applicationDeadline,
        price: course.price,
        sourceUrl: course.sourceUrl,
        officialUrl: course.officialUrl,
        applicationUrl: course.applicationUrl,
        tags: course.tags,
        university: {
          id: course.university.id,
          name: course.university.name,
          shortName: course.university.shortName,
          city: course.university.city,
          type: course.university.type,
          website: course.university.website,
        },
      })),
      filters: {
        level: levelFilter || 'all',
        city: city || null,
        area: area || null,
        university: university || null,
      },
    });
  } catch (error) {
    console.error('Courses export error:', error);
    return NextResponse.json({ error: 'Failed to export courses' }, { status: 500 });
  }
}
