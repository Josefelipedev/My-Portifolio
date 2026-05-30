import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { success, error, withCacheHeaders } from '@/lib/api-utils';

const VALID_STATUSES = ['reading', 'completed', 'want_to_read', 'paused'];

export async function GET() {
  try {
    const books = await prisma.book.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
    const response = NextResponse.json(books);
    return withCacheHeaders(response, 60, 300);
  } catch (err) {
    return error(err);
  }
}

export async function POST(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();

    if (!data.title || !data.author) {
      return NextResponse.json({ error: 'title and author are required' }, { status: 400 });
    }

    if (data.status && !VALID_STATUSES.includes(data.status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    if (data.progress !== undefined && (data.progress < 0 || data.progress > 100)) {
      return NextResponse.json({ error: 'progress must be between 0 and 100' }, { status: 400 });
    }

    if (data.rating !== undefined && data.rating !== null && (data.rating < 1 || data.rating > 5)) {
      return NextResponse.json({ error: 'rating must be between 1 and 5' }, { status: 400 });
    }

    const book = await prisma.book.create({
      data: {
        title: data.title,
        author: data.author,
        coverUrl: data.coverUrl || null,
        progress: data.progress ?? 0,
        status: data.status || 'reading',
        startedAt: data.startedAt ? new Date(data.startedAt) : null,
        finishedAt: data.finishedAt ? new Date(data.finishedAt) : null,
        rating: data.rating || null,
        notes: data.notes || null,
        isbn: data.isbn || null,
        totalPages: data.totalPages || null,
        order: data.order ?? 0,
      },
    });

    return success(book, 201);
  } catch (err) {
    return error(err);
  }
}
