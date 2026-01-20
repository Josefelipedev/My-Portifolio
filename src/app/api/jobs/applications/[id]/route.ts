import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { success, error, Errors } from '@/lib/api-utils';

// GET a single application
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const application = await prisma.jobApplication.findUnique({
      where: { id },
      include: {
        savedJob: true,
      },
    });

    if (!application) {
      throw Errors.NotFound('Application not found');
    }

    return success(application);
  } catch (err) {
    return error(err);
  }
}

// PUT update an application
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();

    // Get current application for timeline update
    const current = await prisma.jobApplication.findUnique({
      where: { id },
    });

    if (!current) {
      throw Errors.NotFound('Application not found');
    }

    // Update timeline if status changed
    let timeline = current.timeline ? JSON.parse(current.timeline) : [];
    if (data.status && data.status !== current.status) {
      timeline.push({
        status: data.status,
        date: new Date().toISOString(),
        note: data.statusNote || `Status changed to ${data.status}`,
      });
    }

    const application = await prisma.jobApplication.update({
      where: { id },
      data: {
        title: data.title !== undefined ? data.title : current.title,
        company: data.company !== undefined ? data.company : current.company,
        url: data.url !== undefined ? data.url : current.url,
        location: data.location !== undefined ? data.location : current.location,
        salary: data.salary !== undefined ? data.salary : current.salary,
        status: data.status || current.status,
        appliedAt: data.appliedAt ? new Date(data.appliedAt) : current.appliedAt,
        notes: data.notes !== undefined ? data.notes : current.notes,
        timeline: JSON.stringify(timeline),
        nextStep: data.nextStep !== undefined ? data.nextStep : current.nextStep,
        nextStepDate: data.nextStepDate !== undefined
          ? (data.nextStepDate ? new Date(data.nextStepDate) : null)
          : current.nextStepDate,
      },
    });

    return success(application);
  } catch (err) {
    return error(err);
  }
}

// DELETE an application
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await prisma.jobApplication.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return error(err);
  }
}
