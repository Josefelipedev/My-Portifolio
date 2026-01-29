import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const education = await prisma.education.findUnique({
    where: { id },
  });
  if (!education) {
    return NextResponse.json({ error: 'Education not found' }, { status: 404 });
  }
  return NextResponse.json(education);
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
  const education = await prisma.education.update({
    where: { id },
    data,
  });
  return NextResponse.json(education);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  await prisma.education.delete({
    where: { id },
  });
  return new NextResponse(null, { status: 204 });
}
