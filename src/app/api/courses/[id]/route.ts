import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';

/**
 * GET /api/courses/[id]
 *
 * Get a single course by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        university: {
          select: {
            id: true,
            name: true,
            shortName: true,
            city: true,
            website: true,
            type: true,
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    return NextResponse.json(course);
  } catch (error) {
    console.error('Get course error:', error);
    return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 });
  }
}

/**
 * PUT /api/courses/[id]
 *
 * Update a course. Requires authentication.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Build update data with only provided fields
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'slug', 'description', 'level', 'area', 'subArea',
      'duration', 'durationMonths', 'credits', 'modality', 'schedule',
      'language', 'city', 'campus', 'startDate', 'applicationDeadline',
      'price', 'currency', 'sourceUrl', 'officialUrl', 'applicationUrl',
      'requirements', 'tags', 'universityId'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] || null;
      }
    }

    // Validate universityId if provided
    if (updateData.universityId) {
      const university = await prisma.university.findUnique({
        where: { id: updateData.universityId as string },
      });
      if (!university) {
        return NextResponse.json({ error: 'University not found' }, { status: 400 });
      }
    }

    const course = await prisma.course.update({
      where: { id },
      data: updateData,
      include: {
        university: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(course);
  } catch (error) {
    console.error('Update course error:', error);
    return NextResponse.json({ error: 'Failed to update course' }, { status: 500 });
  }
}

/**
 * DELETE /api/courses/[id]
 *
 * Delete a course. Requires authentication.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    await prisma.course.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Delete course error:', error);
    return NextResponse.json({ error: 'Failed to delete course' }, { status: 500 });
  }
}
