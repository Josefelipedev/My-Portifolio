import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { validateCSRFToken } from '@/lib/csrf';

interface LinkRequest {
  courseId: string;
  universityId: string;
}

interface BatchLinkRequest {
  links: LinkRequest[];
}

/**
 * POST /api/admin/finduniversity/link
 *
 * Manually link a course to a university.
 * Supports both single linking and batch linking.
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await validateCSRFToken(request))) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();

    // Check if it's a batch request or single request
    if (body.links && Array.isArray(body.links)) {
      // Batch linking
      const { links } = body as BatchLinkRequest;

      if (links.length === 0) {
        return NextResponse.json({ error: 'No links provided' }, { status: 400 });
      }

      if (links.length > 50) {
        return NextResponse.json({ error: 'Maximum 50 links per batch' }, { status: 400 });
      }

      const results = [];
      const errors = [];

      for (const link of links) {
        try {
          // Verify course exists
          const course = await prisma.course.findUnique({
            where: { id: link.courseId },
            select: { id: true, name: true },
          });

          if (!course) {
            errors.push({ courseId: link.courseId, error: 'Course not found' });
            continue;
          }

          // Verify university exists
          const university = await prisma.university.findUnique({
            where: { id: link.universityId },
            select: { id: true, name: true },
          });

          if (!university) {
            errors.push({ courseId: link.courseId, error: 'University not found' });
            continue;
          }

          // Update the course
          const updated = await prisma.course.update({
            where: { id: link.courseId },
            data: { universityId: link.universityId },
            select: {
              id: true,
              name: true,
              university: { select: { id: true, name: true } },
            },
          });

          results.push(updated);
        } catch (err) {
          errors.push({
            courseId: link.courseId,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      return NextResponse.json({
        success: true,
        linked: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      });
    } else {
      // Single linking
      const { courseId, universityId } = body as LinkRequest;

      if (!courseId || !universityId) {
        return NextResponse.json(
          { error: 'Both courseId and universityId are required' },
          { status: 400 }
        );
      }

      // Verify course exists
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, name: true },
      });

      if (!course) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 });
      }

      // Verify university exists
      const university = await prisma.university.findUnique({
        where: { id: universityId },
        select: { id: true, name: true },
      });

      if (!university) {
        return NextResponse.json({ error: 'University not found' }, { status: 404 });
      }

      // Update the course
      const updated = await prisma.course.update({
        where: { id: courseId },
        data: { universityId },
        include: {
          university: {
            select: {
              id: true,
              name: true,
              shortName: true,
              city: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        course: {
          id: updated.id,
          name: updated.name,
          level: updated.level,
          university: updated.university,
        },
        message: `Course "${course.name}" linked to "${university.name}"`,
      });
    }
  } catch (error) {
    console.error('Error linking course:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to link course' },
      { status: 500 }
    );
  }
}
