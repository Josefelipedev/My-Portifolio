import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { error } from '@/lib/api-utils';

// GET - Fetch all alerts with recent matches
export async function GET() {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alerts = await prisma.jobAlert.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        matches: {
          orderBy: { matchedAt: 'desc' },
          take: 5,
        },
        _count: {
          select: { matches: true },
        },
      },
    });

    return NextResponse.json(alerts);
  } catch (err) {
    return error(err);
  }
}

// POST - Create a new alert
export async function POST(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, keyword, countries, sources, filters } = body;

    if (!name || !keyword) {
      return NextResponse.json({ error: 'Name and keyword are required' }, { status: 400 });
    }

    const alert = await prisma.jobAlert.create({
      data: {
        name,
        keyword,
        countries: countries || 'all',
        sources: sources || 'all',
        filters: filters ? JSON.stringify(filters) : null,
      },
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (err) {
    return error(err);
  }
}

// DELETE - Delete an alert
export async function DELETE(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 });
    }

    await prisma.jobAlert.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Alert deleted' });
  } catch (err) {
    return error(err);
  }
}

// PUT - Update an alert
export async function PUT(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, keyword, countries, sources, filters, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (keyword !== undefined) updateData.keyword = keyword;
    if (countries !== undefined) updateData.countries = countries;
    if (sources !== undefined) updateData.sources = sources;
    if (filters !== undefined) updateData.filters = filters ? JSON.stringify(filters) : null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const alert = await prisma.jobAlert.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(alert);
  } catch (err) {
    return error(err);
  }
}
