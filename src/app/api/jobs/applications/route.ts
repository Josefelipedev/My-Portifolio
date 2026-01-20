import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { success, error, validateRequired } from '@/lib/api-utils';

// GET all applications
export async function GET(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where = status ? { status } : {};

    const applications = await prisma.jobApplication.findMany({
      where,
      orderBy: [
        { status: 'asc' },
        { updatedAt: 'desc' },
      ],
      include: {
        savedJob: {
          select: {
            id: true,
            companyLogo: true,
            tags: true,
          },
        },
      },
    });

    return success(applications);
  } catch (err) {
    return error(err);
  }
}

// POST create a manual application (without saved job)
export async function POST(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();

    validateRequired(data, ['title', 'company']);

    const application = await prisma.jobApplication.create({
      data: {
        title: data.title,
        company: data.company,
        url: data.url,
        location: data.location,
        salary: data.salary,
        status: data.status || 'saved',
        appliedAt: data.appliedAt ? new Date(data.appliedAt) : null,
        notes: data.notes,
        timeline: JSON.stringify([
          {
            status: data.status || 'saved',
            date: new Date().toISOString(),
            note: 'Application created manually',
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
