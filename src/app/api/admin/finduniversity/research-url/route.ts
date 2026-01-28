import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { validateCSRFToken } from '@/lib/csrf';

interface UpdateResearchUrlRequest {
  type: 'university' | 'course';
  id: string;
  researchUrl: string | null;
}

/**
 * POST /api/admin/finduniversity/research-url
 *
 * Update the research URL for a university or course.
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await validateCSRFToken(request))) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body: UpdateResearchUrlRequest = await request.json();
    const { type, id, researchUrl } = body;

    if (!type || !['university', 'course'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "university" or "course"' },
        { status: 400 }
      );
    }

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Validate URL if provided
    if (researchUrl) {
      try {
        new URL(researchUrl);
      } catch {
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
      }
    }

    if (type === 'university') {
      // Use raw update to handle schema that may not have researchUrl yet
      const university = await prisma.$executeRaw`
        UPDATE "University" SET "researchUrl" = ${researchUrl || null}, "updatedAt" = NOW() WHERE "id" = ${id}
      `;

      if (university === 0) {
        return NextResponse.json({ error: 'University not found' }, { status: 404 });
      }

      // Fetch updated entity
      const updated = await prisma.university.findUnique({
        where: { id },
        select: { id: true, name: true },
      });

      return NextResponse.json({
        success: true,
        type: 'university',
        entity: { ...updated, researchUrl: researchUrl || null },
      });
    } else {
      // Use raw update to handle schema that may not have researchUrl yet
      const course = await prisma.$executeRaw`
        UPDATE "Course" SET "researchUrl" = ${researchUrl || null}, "updatedAt" = NOW() WHERE "id" = ${id}
      `;

      if (course === 0) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 });
      }

      // Fetch updated entity
      const updated = await prisma.course.findUnique({
        where: { id },
        select: { id: true, name: true },
      });

      return NextResponse.json({
        success: true,
        type: 'course',
        entity: { ...updated, researchUrl: researchUrl || null },
      });
    }
  } catch (error) {
    console.error('Error updating research URL:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update research URL' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/finduniversity/research-url
 *
 * Get entities with research URLs configured.
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    const result: {
      universities?: Array<{
        id: string;
        name: string;
        researchUrl: string | null;
        website: string | null;
      }>;
      courses?: Array<{
        id: string;
        name: string;
        researchUrl: string | null;
        officialUrl: string | null;
        universityName: string | null;
      }>;
    } = {};

    if (type === 'all' || type === 'university') {
      // Use raw query to handle schema that may not have researchUrl yet
      const universities = await prisma.$queryRaw<Array<{
        id: string;
        name: string;
        researchUrl: string | null;
        website: string | null;
      }>>`
        SELECT "id", "name", "researchUrl", "website"
        FROM "University"
        ORDER BY "name" ASC
        LIMIT 100
      `;
      result.universities = universities;
    }

    if (type === 'all' || type === 'course') {
      // Use raw query to handle schema that may not have researchUrl yet
      const courses = await prisma.$queryRaw<Array<{
        id: string;
        name: string;
        researchUrl: string | null;
        officialUrl: string | null;
        universityName: string | null;
      }>>`
        SELECT c."id", c."name", c."researchUrl", c."officialUrl", u."name" as "universityName"
        FROM "Course" c
        LEFT JOIN "University" u ON c."universityId" = u."id"
        ORDER BY c."name" ASC
        LIMIT 100
      `;
      result.courses = courses;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching research URLs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch research URLs' },
      { status: 500 }
    );
  }
}
