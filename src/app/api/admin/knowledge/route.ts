import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { error, success } from '@/lib/api-utils';
import { KNOWLEDGE_TYPES } from '@/lib/knowledge';

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

export async function GET(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const q = searchParams.get('q')?.trim();
    const isActive = parseBoolean(searchParams.get('active'));
    const page = clampNumber(searchParams.get('page'), 1, 10000, 1);
    const pageSize = clampNumber(searchParams.get('pageSize'), 10, 100, 25);

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
        orderBy: [
          { isActive: 'desc' },
          { priority: 'desc' },
          { updatedAt: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.knowledgeItem.count({ where }),
    ]);

    return success({
      items,
      types: KNOWLEDGE_TYPES,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
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
    const title = normalizeText(data.title);
    const content = normalizeText(data.content);
    if (!title || !content || !data.type) {
      return NextResponse.json(
        { error: 'title, content and type are required' },
        { status: 400 }
      );
    }

    if (!KNOWLEDGE_TYPES.includes(data.type)) {
      return NextResponse.json(
        { error: `type must be one of: ${KNOWLEDGE_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const item = await prisma.knowledgeItem.create({
      data: {
        type: data.type,
        title,
        content,
        tags: data.tags ? normalizeText(data.tags) : null,
        source: data.source || 'manual',
        confidence: clampNumber(data.confidence, 1, 5, 4),
        priority: clampNumber(data.priority, 0, 10, 0),
        isActive: data.isActive !== false,
      },
    });

    return success(item, 201);
  } catch (err) {
    return error(err);
  }
}
