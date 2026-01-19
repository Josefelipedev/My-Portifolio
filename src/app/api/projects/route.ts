import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { success, error, withCacheHeaders } from '@/lib/api-utils';

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: [
        { rank: 'asc' },
        { featured: 'desc' },
        { stars: 'desc' },
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
    const { rank, ...projectData } = data;

    // If rank is being set (1, 2, or 3), remove it from any other project
    if (rank && rank >= 1 && rank <= 3) {
      await prisma.project.updateMany({
        where: { rank },
        data: { rank: null },
      });
      projectData.rank = rank;
      // Auto-set featured when setting rank
      projectData.featured = true;
    }

    const project = await prisma.project.create({
      data: projectData,
    });

    return success(project, 201);
  } catch (err) {
    return error(err);
  }
}
