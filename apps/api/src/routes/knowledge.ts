// Knowledge-base admin — ported from the web app's
// src/app/api/admin/knowledge/** handlers. Items CRUD + sources list/create +
// AI source processing. Reads require auth; mutations require auth + CSRF.
// Static subpaths (/knowledge/sources*) are registered before the /:id param
// route so they aren't swallowed by it.

import { Hono } from 'hono';
import prisma from '../db';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';
import { Errors } from '../lib/api-utils';
import { KNOWLEDGE_TYPES, processKnowledgeSource } from '../lib/knowledge';

const knowledge = new Hono<AuthEnv>();

function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numberValue)));
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'string' ? value.trim() : String(value).trim();
}

// ---------------- Items: list ----------------
knowledge.get('/admin/knowledge', requireAuth, async (c) => {
  const type = c.req.query('type') ?? null;
  const q = c.req.query('q')?.trim();
  const isActive = parseBoolean(c.req.query('active') ?? null);
  const page = clampNumber(c.req.query('page'), 1, 10000, 1);
  const pageSize = clampNumber(c.req.query('pageSize'), 10, 100, 25);

  const where = {
    ...(type && type !== 'all' ? { type } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { content: { contains: q, mode: 'insensitive' as const } },
            { tags: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.knowledgeItem.findMany({
      where,
      include: {
        knowledgeSource: {
          select: { id: true, title: true, createdAt: true, processedAt: true },
        },
      },
      orderBy: [{ isActive: 'desc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.knowledgeItem.count({ where }),
  ]);

  return c.json({
    items,
    types: KNOWLEDGE_TYPES,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
});

// ---------------- Items: create ----------------
knowledge.post('/admin/knowledge', requireAuth, requireCsrf, async (c) => {
  const data = (await c.req.json()) as Record<string, unknown>;
  const title = normalizeText(data.title);
  const content = normalizeText(data.content);
  if (!title || !content || !data.type) {
    throw Errors.BadRequest('title, content and type are required');
  }

  if (!(KNOWLEDGE_TYPES as readonly string[]).includes(data.type as string)) {
    throw Errors.BadRequest(`type must be one of: ${KNOWLEDGE_TYPES.join(', ')}`);
  }

  const item = await prisma.knowledgeItem.create({
    data: {
      type: data.type as string,
      title,
      content,
      tags: data.tags ? normalizeText(data.tags) : null,
      source: (data.source as string) || 'manual',
      confidence: clampNumber(data.confidence, 1, 5, 4),
      priority: clampNumber(data.priority, 0, 10, 0),
      isActive: data.isActive !== false,
    },
  });

  return c.json(item, 201);
});

// ---------------- Sources: list (static path before /:id) ----------------
knowledge.get('/admin/knowledge/sources', requireAuth, async (c) => {
  const sources = await prisma.knowledgeSource.findMany({
    select: {
      id: true,
      title: true,
      processedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return c.json({ sources });
});

// ---------------- Sources: create ----------------
knowledge.post('/admin/knowledge/sources', requireAuth, requireCsrf, async (c) => {
  const data = (await c.req.json()) as Record<string, unknown>;
  const rawText = typeof data.rawText === 'string' ? data.rawText.trim() : '';
  if (rawText.length < 100) {
    throw Errors.BadRequest('rawText must be at least 100 characters');
  }

  const source = await prisma.knowledgeSource.create({
    data: {
      title: data.title ? String(data.title).trim() : null,
      rawText,
    },
    select: {
      id: true,
      title: true,
      processedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return c.json({ source, result: null }, 201);
});

// ---------------- Sources: process (AI) ----------------
knowledge.post('/admin/knowledge/sources/:id/process', requireAuth, requireCsrf, async (c) => {
  const result = await processKnowledgeSource(c.req.param('id'));
  return c.json({ result });
});

// ---------------- Items: update ----------------
knowledge.put('/admin/knowledge/:id', requireAuth, requireCsrf, async (c) => {
  const id = c.req.param('id');
  const data = (await c.req.json()) as Record<string, unknown>;

  if (data.type && !(KNOWLEDGE_TYPES as readonly string[]).includes(data.type as string)) {
    throw Errors.BadRequest(`type must be one of: ${KNOWLEDGE_TYPES.join(', ')}`);
  }

  const title = normalizeOptionalText(data.title);
  const content = normalizeOptionalText(data.content);
  if (title !== undefined && !title) {
    throw Errors.BadRequest('title cannot be empty');
  }
  if (content !== undefined && !content) {
    throw Errors.BadRequest('content cannot be empty');
  }

  try {
    const item = await prisma.knowledgeItem.update({
      where: { id },
      data: {
        ...(data.type !== undefined ? { type: data.type as string } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(data.tags !== undefined ? { tags: data.tags ? String(data.tags).trim() : null } : {}),
        ...(data.confidence !== undefined ? { confidence: clampNumber(data.confidence, 1, 5, 4) } : {}),
        ...(data.priority !== undefined ? { priority: clampNumber(data.priority, 0, 10, 0) } : {}),
        ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
      },
    });
    return c.json(item);
  } catch {
    throw Errors.NotFound('Knowledge item not found');
  }
});

// ---------------- Items: delete ----------------
knowledge.delete('/admin/knowledge/:id', requireAuth, requireCsrf, async (c) => {
  try {
    await prisma.knowledgeItem.delete({ where: { id: c.req.param('id') } });
    return c.body(null, 204);
  } catch {
    throw Errors.NotFound('Knowledge item not found');
  }
});

// Clear the entire knowledge base (delete every item).
knowledge.delete('/admin/knowledge', requireAuth, requireCsrf, async (c) => {
  const { count } = await prisma.knowledgeItem.deleteMany({});
  return c.json({ deleted: count });
});

export default knowledge;
