import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { error } from '@/lib/api-utils';

// Calculate the next run time based on schedule settings
function calculateNextRun(scheduleHours: string, scheduleDays: string): Date | null {
  if (!scheduleHours) return null;

  const hours = scheduleHours.split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h) && h >= 0 && h <= 23);
  const days = scheduleDays ? scheduleDays.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d) && d >= 0 && d <= 6) : [0, 1, 2, 3, 4, 5, 6];

  if (hours.length === 0) return null;

  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay();

  // Find the next valid hour today
  const nextHourToday = hours.find(h => h > currentHour);
  if (nextHourToday !== undefined && days.includes(currentDay)) {
    const next = new Date(now);
    next.setHours(nextHourToday, 0, 0, 0);
    return next;
  }

  // Find the next valid day
  for (let i = 1; i <= 7; i++) {
    const checkDay = (currentDay + i) % 7;
    if (days.includes(checkDay)) {
      const next = new Date(now);
      next.setDate(now.getDate() + i);
      next.setHours(hours[0], 0, 0, 0);
      return next;
    }
  }

  return null;
}

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
    const { name, keyword, countries, sources, filters, scheduleEnabled, scheduleHours, scheduleDays, emailOnMatch } = body;

    if (!name || !keyword) {
      return NextResponse.json({ error: 'Name and keyword are required' }, { status: 400 });
    }

    // Calculate next run if scheduling is enabled
    let nextRun: Date | null = null;
    if (scheduleEnabled && scheduleHours) {
      nextRun = calculateNextRun(scheduleHours, scheduleDays || '');
    }

    const alert = await prisma.jobAlert.create({
      data: {
        name,
        keyword,
        countries: countries || 'all',
        sources: sources || 'all',
        filters: filters ? JSON.stringify(filters) : null,
        scheduleEnabled: scheduleEnabled || false,
        scheduleHours: scheduleHours || null,
        scheduleDays: scheduleDays || null,
        nextRun,
        emailOnMatch: emailOnMatch !== undefined ? emailOnMatch : true,
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
    const { id, name, keyword, countries, sources, filters, isActive, scheduleEnabled, scheduleHours, scheduleDays, emailOnMatch } = body;

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
    if (scheduleEnabled !== undefined) updateData.scheduleEnabled = scheduleEnabled;
    if (scheduleHours !== undefined) updateData.scheduleHours = scheduleHours || null;
    if (scheduleDays !== undefined) updateData.scheduleDays = scheduleDays || null;
    if (emailOnMatch !== undefined) updateData.emailOnMatch = emailOnMatch;

    // Recalculate next run if scheduling settings changed
    if (scheduleEnabled !== undefined || scheduleHours !== undefined || scheduleDays !== undefined) {
      const finalScheduleEnabled = scheduleEnabled !== undefined ? scheduleEnabled : (await prisma.jobAlert.findUnique({ where: { id } }))?.scheduleEnabled;
      const finalScheduleHours = scheduleHours !== undefined ? scheduleHours : (await prisma.jobAlert.findUnique({ where: { id } }))?.scheduleHours;
      const finalScheduleDays = scheduleDays !== undefined ? scheduleDays : (await prisma.jobAlert.findUnique({ where: { id } }))?.scheduleDays;

      if (finalScheduleEnabled && finalScheduleHours) {
        updateData.nextRun = calculateNextRun(finalScheduleHours, finalScheduleDays || '');
      } else {
        updateData.nextRun = null;
      }
    }

    const alert = await prisma.jobAlert.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(alert);
  } catch (err) {
    return error(err);
  }
}
