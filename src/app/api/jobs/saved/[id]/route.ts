import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { success, error, Errors } from '@/lib/api-utils';

// GET a single saved job
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const savedJob = await prisma.savedJob.findUnique({
      where: { id },
      include: {
        application: true,
      },
    });

    if (!savedJob) {
      throw Errors.NotFound('Saved job not found');
    }

    return success(savedJob);
  } catch (err) {
    return error(err);
  }
}

// PUT update a saved job (mainly for notes)
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

    const savedJob = await prisma.savedJob.update({
      where: { id },
      data: {
        notes: data.notes,
      },
    });

    return success(savedJob);
  } catch (err) {
    return error(err);
  }
}

// DELETE a saved job
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await prisma.savedJob.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return error(err);
  }
}
