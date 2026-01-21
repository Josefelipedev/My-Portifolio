import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { success, error, Errors, validateRequired } from '@/lib/api-utils';

// GET all saved jobs
export async function GET() {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const savedJobs = await prisma.savedJob.findMany({
      orderBy: { savedAt: 'desc' },
      include: {
        application: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    return success(savedJobs);
  } catch (err) {
    return error(err);
  }
}

// POST save a new job
export async function POST(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();

    validateRequired(data, ['externalId', 'source', 'title', 'company', 'url']);

    // Check if already saved
    const existing = await prisma.savedJob.findUnique({
      where: { externalId: data.externalId },
    });

    if (existing) {
      throw Errors.BadRequest('Job already saved');
    }

    const savedJob = await prisma.savedJob.create({
      data: {
        externalId: data.externalId,
        source: data.source,
        title: data.title,
        company: data.company,
        companyLogo: data.companyLogo,
        description: data.description || '',
        url: data.url,
        location: data.location,
        jobType: data.jobType,
        salary: data.salary,
        tags: data.tags ? (Array.isArray(data.tags) ? data.tags.join(',') : data.tags) : null,
        postedAt: data.postedAt ? new Date(data.postedAt) : null,
        notes: data.notes,
      },
    });

    return success(savedJob, 201);
  } catch (err) {
    return error(err);
  }
}
