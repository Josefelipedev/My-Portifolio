import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';

const VALID_STATUSES = ['reading', 'completed', 'want_to_read', 'paused'];

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const data = await request.json();

  if (data.status && !VALID_STATUSES.includes(data.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  if (data.progress !== undefined && (data.progress < 0 || data.progress > 100)) {
    return NextResponse.json({ error: 'progress must be between 0 and 100' }, { status: 400 });
  }

  try {
    const book = await prisma.book.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.author !== undefined && { author: data.author }),
        ...(data.coverUrl !== undefined && { coverUrl: data.coverUrl || null }),
        ...(data.progress !== undefined && { progress: data.progress }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.startedAt !== undefined && { startedAt: data.startedAt ? new Date(data.startedAt) : null }),
        ...(data.finishedAt !== undefined && { finishedAt: data.finishedAt ? new Date(data.finishedAt) : null }),
        ...(data.rating !== undefined && { rating: data.rating || null }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.isbn !== undefined && { isbn: data.isbn || null }),
        ...(data.totalPages !== undefined && { totalPages: data.totalPages || null }),
        ...(data.order !== undefined && { order: data.order }),
      },
    });
    return NextResponse.json(book);
  } catch {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
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
    await prisma.book.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }
}
