import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';

interface ImportedBook {
  title?: string;
  author?: string;
  cover?: string;
  coverUrl?: string;
  progress?: number;
  percentage?: number; // Koodo Reader uses 0-1 range
  status?: string;
  readingStatus?: string;
  rating?: number;
  notes?: string;
  description?: string;
  isbn?: string;
  totalPages?: number;
}

function normalizeStatus(raw?: string, progress?: number): string {
  if (!raw) {
    if (progress !== undefined) {
      if (progress >= 100) return 'completed';
      if (progress > 0) return 'reading';
    }
    return 'reading';
  }

  const s = raw.toLowerCase().replace(/[^a-z_]/g, '');
  if (s === 'reading' || s === 'inprogress' || s === 'in_progress') return 'reading';
  if (s === 'completed' || s === 'finished' || s === 'read' || s === 'done') return 'completed';
  if (s === 'want_to_read' || s === 'wanttoread' || s === 'wishlist' || s === 'toread') return 'want_to_read';
  if (s === 'paused' || s === 'onhold' || s === 'on_hold') return 'paused';
  return 'reading';
}

function normalizeProgress(book: ImportedBook): number {
  // Koodo Reader percentage is 0-1 float
  if (book.percentage !== undefined) {
    return Math.round(book.percentage * 100);
  }
  if (book.progress !== undefined) {
    // Could be 0-1 or 0-100
    if (book.progress <= 1) return Math.round(book.progress * 100);
    return Math.min(100, Math.max(0, Math.round(book.progress)));
  }
  return 0;
}

export async function POST(request: Request) {
  if (!await isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const raw: ImportedBook[] = Array.isArray(body) ? body : body.books ?? body.data ?? [];

    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ error: 'No books found in the imported data' }, { status: 400 });
    }

    let imported = 0;
    let skipped = 0;

    for (const item of raw) {
      const title = item.title?.trim();
      const author = item.author?.trim();

      if (!title || !author) {
        skipped++;
        continue;
      }

      // Skip duplicates by title + author
      const existing = await prisma.book.findFirst({
        where: { title, author },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const progress = normalizeProgress(item);
      const status = normalizeStatus(item.status ?? item.readingStatus, progress);

      await prisma.book.create({
        data: {
          title,
          author,
          coverUrl: item.coverUrl ?? item.cover ?? null,
          progress,
          status,
          rating: item.rating ?? null,
          notes: item.notes ?? item.description ?? null,
          isbn: item.isbn ?? null,
          totalPages: item.totalPages ?? null,
        },
      });

      imported++;
    }

    return NextResponse.json({ imported, skipped, total: raw.length });
  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json({ error: 'Failed to import books' }, { status: 500 });
  }
}
