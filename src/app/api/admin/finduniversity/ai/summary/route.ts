import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { callAIWithTracking } from '@/lib/claude';
import {
  getCourseDescriptionPrompt,
  getUniversityDescriptionPrompt,
} from '@/lib/finduniversity/ai-prompts';
import { validateCSRFToken } from '@/lib/csrf';

interface SummaryRequest {
  type: 'course' | 'university';
  id?: string;
  batchMode?: boolean;
  batchLimit?: number;
}

/**
 * POST /api/admin/finduniversity/ai/summary
 *
 * Generate AI descriptions for courses or universities.
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await validateCSRFToken(request))) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body: SummaryRequest = await request.json();
    const { type, id, batchMode = false, batchLimit = 10 } = body;

    if (!type || !['course', 'university'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "course" or "university"' },
        { status: 400 }
      );
    }

    const results: Array<{ id: string; name: string; description: string }> = [];

    if (type === 'course') {
      // Generate for courses
      const whereClause = batchMode
        ? { description: null }
        : id
          ? { id }
          : null;

      if (!whereClause) {
        return NextResponse.json(
          { error: 'Must provide id or use batchMode' },
          { status: 400 }
        );
      }

      const courses = await prisma.course.findMany({
        where: whereClause,
        take: batchMode ? batchLimit : 1,
        include: { university: { select: { name: true } } },
      });

      for (const course of courses) {
        const prompt = getCourseDescriptionPrompt({
          name: course.name,
          universityName: course.university.name,
          level: course.level,
          area: course.area || undefined,
          subArea: course.subArea || undefined,
          duration: course.duration || undefined,
          modality: course.modality || undefined,
          city: course.city || undefined,
          credits: course.credits || undefined,
          price: course.price || undefined,
        });

        const { content } = await callAIWithTracking(prompt, 'finduniversity-summary', {
          maxTokens: 800,
          temperature: 0.7,
          metadata: { type: 'course', courseId: course.id },
        });

        // Update the course with the generated description
        await prisma.course.update({
          where: { id: course.id },
          data: { description: content },
        });

        results.push({
          id: course.id,
          name: course.name,
          description: content,
        });
      }
    } else {
      // Generate for universities
      const whereClause = batchMode
        ? { description: null }
        : id
          ? { id }
          : null;

      if (!whereClause) {
        return NextResponse.json(
          { error: 'Must provide id or use batchMode' },
          { status: 400 }
        );
      }

      const universities = await prisma.university.findMany({
        where: whereClause,
        take: batchMode ? batchLimit : 1,
        include: { _count: { select: { courses: true } } },
      });

      for (const university of universities) {
        const prompt = getUniversityDescriptionPrompt({
          name: university.name,
          shortName: university.shortName || undefined,
          city: university.city || undefined,
          type: university.type || undefined,
          coursesCount: university._count.courses,
        });

        const { content } = await callAIWithTracking(prompt, 'finduniversity-summary', {
          maxTokens: 800,
          temperature: 0.7,
          metadata: { type: 'university', universityId: university.id },
        });

        // Update the university with the generated description
        await prisma.university.update({
          where: { id: university.id },
          data: { description: content },
        });

        results.push({
          id: university.id,
          name: university.name,
          description: content,
        });
      }
    }

    return NextResponse.json({
      success: true,
      generated: results.length,
      results,
    });
  } catch (error) {
    console.error('Summary generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summaries' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/finduniversity/ai/summary
 *
 * Get counts of items without descriptions.
 */
export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [coursesWithoutDesc, universitiesWithoutDesc, totalCourses, totalUniversities] =
      await Promise.all([
        prisma.course.count({ where: { description: null } }),
        prisma.university.count({ where: { description: null } }),
        prisma.course.count(),
        prisma.university.count(),
      ]);

    return NextResponse.json({
      courses: {
        withoutDescription: coursesWithoutDesc,
        total: totalCourses,
      },
      universities: {
        withoutDescription: universitiesWithoutDesc,
        total: totalUniversities,
      },
    });
  } catch (error) {
    console.error('Summary stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
