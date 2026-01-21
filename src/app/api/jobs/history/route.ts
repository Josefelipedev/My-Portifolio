import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { error } from '@/lib/api-utils';

// GET - Fetch search history
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
    });

    return NextResponse.json(history);
  } catch (err) {
    return error(err);
  }
}

// POST - Save a new search to history
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

    // Check if the same search was made recently (within 1 minute)
    const recentSearch = await prisma.jobSearchHistory.findFirst({
      where: {
        keyword,
        countries,
        sources,
        searchedAt: {
          gte: new Date(Date.now() - 60 * 1000),
        },
      },
    });

    if (recentSearch) {
      // Update the existing search
      const updated = await prisma.jobSearchHistory.update({
        where: { id: recentSearch.id },
        data: {
          resultCount,
          searchedAt: new Date(),
        },
      });
      return NextResponse.json(updated);
    }

    // Create new search history entry
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

// DELETE - Clear search history
export async function DELETE(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.jobSearchHistory.deleteMany({});

    return NextResponse.json({ message: 'History cleared' });
  } catch (err) {
    return error(err);
  }
}
