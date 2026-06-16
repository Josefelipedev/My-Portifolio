import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { error, success } from '@/lib/api-utils';
import { KNOWLEDGE_TYPES } from '@/lib/knowledge';

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numberValue)));
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'string' ? value.trim() : String(value).trim();
}

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

    if (data.type && !KNOWLEDGE_TYPES.includes(data.type)) {
      return NextResponse.json(
        { error: `type must be one of: ${KNOWLEDGE_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const title = normalizeOptionalText(data.title);
    const content = normalizeOptionalText(data.content);
    if (title !== undefined && !title) {
      return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 });
    }
    if (content !== undefined && !content) {
      return NextResponse.json({ error: 'content cannot be empty' }, { status: 400 });
    }

    const item = await prisma.knowledgeItem.update({
      where: { id },
      data: {
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(data.tags !== undefined ? { tags: data.tags ? String(data.tags).trim() : null } : {}),
        ...(data.confidence !== undefined
          ? { confidence: clampNumber(data.confidence, 1, 5, 4) }
          : {}),
        ...(data.priority !== undefined
          ? { priority: clampNumber(data.priority, 0, 10, 0) }
          : {}),
        ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
      },
    });

    return success(item);
  } catch (err) {
    return error(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await prisma.knowledgeItem.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return error(err);
  }
}
