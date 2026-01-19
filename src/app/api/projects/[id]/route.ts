import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const data = await request.json();
  const { rank, ...updateData } = data;

  // If rank is being set (1, 2, or 3), remove it from any other project
  if (rank !== undefined) {
    if (rank && rank >= 1 && rank <= 3) {
      // Remove this rank from any other project
      await prisma.project.updateMany({
        where: {
          rank,
          id: { not: id }
        },
        data: { rank: null },
      });
      updateData.rank = rank;
      // Auto-set featured when setting rank
      updateData.featured = true;
    } else {
      // Setting rank to null (removing from top 3)
      updateData.rank = null;
    }
  }

  const project = await prisma.project.update({
    where: { id },
    data: updateData,
  });
  return NextResponse.json(project);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  await prisma.project.delete({
    where: { id },
  });
  return new NextResponse(null, { status: 204 });
}
