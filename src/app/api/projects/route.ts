import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { success, error, withCacheHeaders } from '@/lib/api-utils';

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: [
        { featured: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const response = NextResponse.json(projects);
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
    const project = await prisma.project.create({
      data,
    });

    return success(project, 201);
  } catch (err) {
    return error(err);
  }
}
