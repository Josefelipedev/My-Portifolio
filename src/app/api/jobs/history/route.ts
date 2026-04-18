import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { error } from '@/lib/api-utils';

// GET - Fetch search history (without results blob to keep payload small)
export async function GET(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;

    const history = await prisma.jobSearchHistory.findMany({
      orderBy: { searchedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        keyword: true,
        countries: true,
        sources: true,
        filters: true,
        resultCount: true,
        cachedUntil: true,
        searchedAt: true,
        // exclude results to keep response small
      },
    });

    const now = new Date();
    return NextResponse.json(
      history.map((h) => ({
        ...h,
        isCached: h.cachedUntil ? h.cachedUntil > now : false,
      }))
    );
  } catch (err) {
    return error(err);
  }
}

// POST - Save a new search to history (legacy — now handled by search route)
export async function POST(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { keyword, countries, sources, filters, resultCount } = body;

    if (!keyword) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
    }

    const recentSearch = await prisma.jobSearchHistory.findFirst({
      where: {
        keyword,
        countries,
        sources,
        searchedAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
    });

    if (recentSearch) {
      const updated = await prisma.jobSearchHistory.update({
        where: { id: recentSearch.id },
        data: { resultCount, searchedAt: new Date() },
      });
      return NextResponse.json(updated);
    }

    const entry = await prisma.jobSearchHistory.create({
      data: {
        keyword,
        countries: countries || 'all',
        sources: sources || 'all',
        filters: filters ? JSON.stringify(filters) : null,
        resultCount: resultCount || 0,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return error(err);
  }
}

// DELETE - Clear all history or invalidate cache for a specific entry
export async function DELETE(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      await prisma.jobSearchHistory.delete({ where: { id } });
      return NextResponse.json({ message: 'Entry deleted' });
    }

    // Clear all history
    await prisma.jobSearchHistory.deleteMany({});
    return NextResponse.json({ message: 'History cleared' });
  } catch (err) {
    return error(err);
  }
}
