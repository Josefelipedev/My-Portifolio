import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { error, success } from '@/lib/api-utils';

export async function GET() {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    return success({ sources });
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
    const rawText = typeof data.rawText === 'string' ? data.rawText.trim() : '';
    if (rawText.length < 100) {
      return NextResponse.json(
        { error: 'rawText must be at least 100 characters' },
        { status: 400 }
      );
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

    return success({ source, result: null }, 201);
  } catch (err) {
    return error(err);
  }
}
