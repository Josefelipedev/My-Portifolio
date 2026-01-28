import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';

/**
 * DELETE /api/universities/bulk
 *
 * Delete all universities and their courses. Requires authentication.
 * This is a dangerous operation and should be used with caution.
 */
export async function DELETE() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get count before deletion for the response
    const count = await prisma.university.count();

    if (count === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        message: 'No universities to delete'
      });
    }

    // Delete all universities (courses will be cascade deleted due to schema configuration)
    await prisma.university.deleteMany({});

    return NextResponse.json({
      success: true,
      deleted: count,
      message: `Successfully deleted ${count} universities and all associated courses`
    });
  } catch (error) {
    console.error('Bulk delete universities error:', error);
    return NextResponse.json(
      { error: 'Failed to delete universities' },
      { status: 500 }
    );
  }
}
