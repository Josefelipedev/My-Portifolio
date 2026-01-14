import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const skill = await prisma.skill.findUnique({
    where: { id },
  });
  if (!skill) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }
  return NextResponse.json(skill);
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

  // Validate category if provided
  if (data.category) {
    const validCategories = ['frontend', 'backend', 'devops', 'tools', 'other'];
    if (!validCategories.includes(data.category)) {
      return NextResponse.json(
        { error: `category must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }
  }

  // Validate level if provided (1-5)
  if (data.level !== undefined && (data.level < 1 || data.level > 5)) {
    return NextResponse.json(
      { error: 'level must be between 1 and 5' },
      { status: 400 }
    );
  }

  try {
    const skill = await prisma.skill.update({
      where: { id },
      data,
    });
    return NextResponse.json(skill);
  } catch {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.skill.delete({
      where: { id },
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }
}
