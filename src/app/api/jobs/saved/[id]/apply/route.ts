import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { success, error, Errors } from '@/lib/api-utils';

// POST create an application from a saved job
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();

    // Get the saved job
    const savedJob = await prisma.savedJob.findUnique({
      where: { id },
      include: { application: true },
    });

    if (!savedJob) {
      throw Errors.NotFound('Saved job not found');
    }

    if (savedJob.application) {
      throw Errors.BadRequest('Application already exists for this job');
    }

    // Create application from saved job data
    const application = await prisma.jobApplication.create({
      data: {
        savedJobId: savedJob.id,
        title: savedJob.title,
        company: savedJob.company,
        url: savedJob.url,
        location: savedJob.location,
        salary: savedJob.salary,
        status: data.status || 'applied',
        appliedAt: data.appliedAt ? new Date(data.appliedAt) : new Date(),
        notes: data.notes || savedJob.notes,
        timeline: JSON.stringify([
          {
            status: data.status || 'applied',
            date: new Date().toISOString(),
            note: 'Application created',
          },
        ]),
        nextStep: data.nextStep,
        nextStepDate: data.nextStepDate ? new Date(data.nextStepDate) : null,
      },
    });

    return success(application, 201);
  } catch (err) {
    return error(err);
  }
}
