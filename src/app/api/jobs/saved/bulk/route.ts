import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { error } from '@/lib/api-utils';

// DELETE - Bulk delete saved jobs
export async function DELETE(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs array is required' }, { status: 400 });
    }

    // First, delete any associated applications
    await prisma.jobApplication.deleteMany({
      where: {
        savedJobId: {
          in: ids,
        },
      },
    });

    // Then delete the saved jobs
    const result = await prisma.savedJob.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return NextResponse.json({
      message: `${result.count} jobs deleted`,
      count: result.count,
    });
  } catch (err) {
    return error(err);
  }
}
