import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { success, error, Errors, validateRequired } from '@/lib/api-utils';

// GET saved jobs with pagination
export async function GET(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const [savedJobs, total] = await Promise.all([
      prisma.savedJob.findMany({
        orderBy: { savedAt: 'desc' },
        skip,
        take: limit,
        include: {
          application: {
            select: { id: true, status: true, appliedAt: true },
          },
        },
      }),
      prisma.savedJob.count(),
    ]);

    return success({
      jobs: savedJobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + savedJobs.length < total,
    });
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
