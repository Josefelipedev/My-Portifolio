import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { error } from '@/lib/api-utils';

// DELETE - Bulk delete applications
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

    const result = await prisma.jobApplication.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return NextResponse.json({
      message: `${result.count} applications deleted`,
      count: result.count,
    });
  } catch (err) {
    return error(err);
  }
}

// PUT - Bulk update application status
export async function PUT(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ids, status } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs array is required' }, { status: 400 });
    }

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const validStatuses = ['saved', 'applied', 'interview', 'offer', 'rejected'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Get current applications to update their timelines
    const applications = await prisma.jobApplication.findMany({
      where: {
        id: { in: ids },
      },
      select: {
        id: true,
        timeline: true,
      },
    });

    // Update each application with new status and timeline entry
    const updates = applications.map((app) => {
      const currentTimeline = app.timeline ? JSON.parse(app.timeline) : [];
      const newTimelineEntry = {
        status,
        date: new Date().toISOString(),
        note: 'Bulk status update',
      };
      currentTimeline.push(newTimelineEntry);

      return prisma.jobApplication.update({
        where: { id: app.id },
        data: {
          status,
          timeline: JSON.stringify(currentTimeline),
          appliedAt: status === 'applied' && !currentTimeline.some((t: { status: string }) => t.status === 'applied')
            ? new Date()
            : undefined,
        },
      });
    });

    await Promise.all(updates);

    return NextResponse.json({
      message: `${ids.length} applications updated to ${status}`,
      count: ids.length,
    });
  } catch (err) {
    return error(err);
  }
}
