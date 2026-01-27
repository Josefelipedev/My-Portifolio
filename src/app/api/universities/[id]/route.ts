import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';

/**
 * GET /api/universities/[id]
 *
 * Get a single university by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const university = await prisma.university.findUnique({
      where: { id },
      include: {
        courses: {
          select: {
            id: true,
            name: true,
            level: true,
            city: true,
          },
          orderBy: { name: 'asc' },
        },
        _count: {
          select: { courses: true },
        },
      },
    });

    if (!university) {
      return NextResponse.json({ error: 'University not found' }, { status: 404 });
    }

    return NextResponse.json(university);
  } catch (error) {
    console.error('Get university error:', error);
    return NextResponse.json({ error: 'Failed to fetch university' }, { status: 500 });
  }
}

/**
 * PUT /api/universities/[id]
 *
 * Update a university. Requires authentication.
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

    const existing = await prisma.university.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'University not found' }, { status: 404 });
    }

    // Build update data with only provided fields
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'shortName', 'description', 'website', 'sourceUrl',
      'city', 'region', 'address', 'logoUrl', 'email', 'phone', 'type'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] || null;
      }
    }

    const university = await prisma.university.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(university);
  } catch (error) {
    console.error('Update university error:', error);
    return NextResponse.json({ error: 'Failed to update university' }, { status: 500 });
  }
}

/**
 * DELETE /api/universities/[id]
 *
 * Delete a university and all its courses. Requires authentication.
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

    const existing = await prisma.university.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'University not found' }, { status: 404 });
    }

    // Delete university (courses will be cascade deleted)
    await prisma.university.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Delete university error:', error);
    return NextResponse.json({ error: 'Failed to delete university' }, { status: 500 });
  }
}
