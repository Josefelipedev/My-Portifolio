import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { success, error, withCacheHeaders } from '@/lib/api-utils';

export async function GET() {
  try {
    const skills = await prisma.skill.findMany({
      orderBy: [
        { category: 'asc' },
        { order: 'asc' },
        { name: 'asc' },
      ],
    });

    const response = NextResponse.json(skills);
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

    // Validate required fields
    if (!data.name || !data.category) {
      return NextResponse.json(
        { error: 'name and category are required' },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = ['frontend', 'backend', 'devops', 'tools', 'other'];
    if (!validCategories.includes(data.category)) {
      return NextResponse.json(
        { error: `category must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate level (1-5)
    if (data.level !== undefined && (data.level < 1 || data.level > 5)) {
      return NextResponse.json(
        { error: 'level must be between 1 and 5' },
        { status: 400 }
      );
    }

    const skill = await prisma.skill.create({
      data: {
        name: data.name,
        category: data.category,
        level: data.level || 3,
        iconUrl: data.iconUrl || null,
        order: data.order || 0,
      },
    });

    return success(skill, 201);
  } catch (err) {
    return error(err);
  }
}
