import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';

/**
 * GET /api/admin/finduniversity/unlinked
 *
 * List courses that don't have a university linked or have linking issues.
 * This helps identify courses that need manual linking.
 */
export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find courses where university relationship might have issues
    // Since universityId is required in schema, we look for courses
    // where the university might not exist anymore or has issues
    const coursesWithIssues = await prisma.course.findMany({
      where: {
        OR: [
          // Courses where university relation fails
          { university: { is: null } },
        ],
      },
      select: {
        id: true,
        name: true,
        level: true,
        city: true,
        sourceUrl: true,
        universityId: true,
        university: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: 100,
      orderBy: { name: 'asc' },
    });

    // Also get count of all courses for context
    const totalCourses = await prisma.course.count();

    // Get all universities for the linking dropdown
    const universities = await prisma.university.findMany({
      select: {
        id: true,
        name: true,
        shortName: true,
        city: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      unlinkedCourses: coursesWithIssues,
      totalUnlinked: coursesWithIssues.length,
      totalCourses,
      universities,
    });
  } catch (error) {
    console.error('Error fetching unlinked courses:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch unlinked courses' },
      { status: 500 }
    );
  }
}
