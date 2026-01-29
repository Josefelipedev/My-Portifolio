import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { success, error, withCacheHeaders } from '@/lib/api-utils';

export async function GET() {
  try {
    const education = await prisma.education.findMany({
      orderBy: [
        { startDate: 'desc' },
        { order: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    const response = NextResponse.json(education);
    // Cache for 1 minute, stale-while-revalidate for 5 minutes
    return withCacheHeaders(response, 60, 300);
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
    const education = await prisma.education.create({
      data,
    });

    return success(education, 201);
  } catch (err) {
    return error(err);
  }
}
