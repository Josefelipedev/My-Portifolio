// Authenticated content mutations for books + bulk imports — ported from the
// web app's src/app/api/books/[id] (PUT/DELETE), src/app/api/books/import (POST)
// and src/app/api/education/import (POST). Every route mutates, so each is
// guarded by requireAuth + requireCsrf. Paths keep parity with the web
// (PUT/DELETE /api/books/:id, POST /api/books/import, POST /api/education/import).
//
// Validation, normalization (Koodo Reader progress/status) and response shapes
// are kept faithful to the web handlers. The education import reads resume.json
// from RESUME_JSON_PATH (defaults to <cwd>/data/resume.json for the API service),
// mirroring how resume.ts decouples its stored-PDF path.

import { Hono } from 'hono';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import prisma from '../db';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';

const router = new Hono<AuthEnv>();

// ---------------- Books: update / delete ----------------
const VALID_STATUSES = ['reading', 'completed', 'want_to_read', 'paused'];

router.put('/books/:id', requireAuth, requireCsrf, async (c) => {
  const id = c.req.param('id');
  const data = (await c.req.json()) as Record<string, unknown>;

  if (data.status && !VALID_STATUSES.includes(String(data.status))) {
    return c.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, 400);
  }

  const progress = data.progress as number | undefined;
  if (progress !== undefined && (progress < 0 || progress > 100)) {
    return c.json({ error: 'progress must be between 0 and 100' }, 400);
  }

  try {
    const book = await prisma.book.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title as string }),
        ...(data.author !== undefined && { author: data.author as string }),
        ...(data.coverUrl !== undefined && { coverUrl: (data.coverUrl as string) || null }),
        ...(data.progress !== undefined && { progress: data.progress as number }),
        ...(data.status !== undefined && { status: data.status as string }),
        ...(data.startedAt !== undefined && {
          startedAt: data.startedAt ? new Date(data.startedAt as string) : null,
        }),
        ...(data.finishedAt !== undefined && {
          finishedAt: data.finishedAt ? new Date(data.finishedAt as string) : null,
        }),
        ...(data.rating !== undefined && { rating: (data.rating as number) || null }),
        ...(data.notes !== undefined && { notes: (data.notes as string) || null }),
        ...(data.isbn !== undefined && { isbn: (data.isbn as string) || null }),
        ...(data.totalPages !== undefined && { totalPages: (data.totalPages as number) || null }),
        ...(data.order !== undefined && { order: data.order as number }),
      },
    });
    return c.json(book);
  } catch {
    return c.json({ error: 'Book not found' }, 404);
  }
});

router.delete('/books/:id', requireAuth, requireCsrf, async (c) => {
  try {
    await prisma.book.delete({ where: { id: c.req.param('id') } });
    return c.body(null, 204);
  } catch {
    return c.json({ error: 'Book not found' }, 404);
  }
});

// ---------------- Books: bulk import ----------------
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

router.post('/books/import', requireAuth, requireCsrf, async (c) => {
  try {
    const body = (await c.req.json()) as ImportedBook[] | { books?: ImportedBook[]; data?: ImportedBook[] };
    const raw: ImportedBook[] = Array.isArray(body) ? body : body.books ?? body.data ?? [];

    if (!Array.isArray(raw) || raw.length === 0) {
      return c.json({ error: 'No books found in the imported data' }, 400);
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

    return c.json({ imported, skipped, total: raw.length });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Import error:', err);
    return c.json({ error: 'Failed to import books' }, 500);
  }
});

// ---------------- Education: import from resume.json ----------------
interface ResumeEducation {
  degree: string;
  institution: string;
  location?: string;
  startDate?: string;
  endDate?: string | null;
  description?: string;
}

interface ResumeCertification {
  name: string;
  issuer: string;
  date?: string;
  description?: string;
}

interface ResumeData {
  education?: ResumeEducation[];
  certifications?: ResumeCertification[];
}

function resumeJsonPath(): string {
  return process.env.RESUME_JSON_PATH || path.join(process.cwd(), 'data', 'resume.json');
}

router.post('/education/import', requireAuth, requireCsrf, async (c) => {
  try {
    const fileContent = await fs.readFile(resumeJsonPath(), 'utf-8');
    const resumeData: ResumeData = JSON.parse(fileContent);

    const results = {
      education: { created: 0, skipped: 0 },
      certifications: { created: 0, skipped: 0 },
    };

    // Import education (degrees)
    if (resumeData.education?.length) {
      for (const edu of resumeData.education) {
        const existing = await prisma.education.findFirst({
          where: {
            title: edu.degree,
            institution: edu.institution,
          },
        });

        if (existing) {
          results.education.skipped++;
          continue;
        }

        await prisma.education.create({
          data: {
            title: edu.degree,
            institution: edu.institution,
            type: 'degree',
            location: edu.location || null,
            description: edu.description || null,
            startDate: edu.startDate ? new Date(`${edu.startDate}-01`) : null,
            endDate: edu.endDate ? new Date(`${edu.endDate}-01`) : null,
          },
        });
        results.education.created++;
      }
    }

    // Import certifications
    if (resumeData.certifications?.length) {
      for (const cert of resumeData.certifications) {
        const existing = await prisma.education.findFirst({
          where: {
            title: cert.name,
            institution: cert.issuer,
            type: 'certification',
          },
        });

        if (existing) {
          results.certifications.skipped++;
          continue;
        }

        await prisma.education.create({
          data: {
            title: cert.name,
            institution: cert.issuer,
            type: 'certification',
            description: cert.description || null,
            startDate: cert.date ? new Date(`${cert.date}-01`) : null,
            endDate: cert.date ? new Date(`${cert.date}-01`) : null,
          },
        });
        results.certifications.created++;
      }
    }

    const total = results.education.created + results.certifications.created;
    const skipped = results.education.skipped + results.certifications.skipped;

    return c.json({
      success: true,
      results,
      message: `Imported ${total} items (${skipped} already existed)`,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error importing from resume:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to import' }, 500);
  }
});

export default router;
