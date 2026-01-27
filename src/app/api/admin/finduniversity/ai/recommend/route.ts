import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { callAIWithTracking } from '@/lib/claude';
import { getRecommendationPrompt } from '@/lib/finduniversity/ai-prompts';
import { validateCSRFToken } from '@/lib/csrf';
import { Prisma } from '@prisma/client';

interface RecommendRequest {
  interests: string[];
  currentEducation?: string;
  careerGoals?: string;
  preferences?: {
    city?: string;
    modality?: string;
    maxPrice?: number;
    level?: string;
  };
}

interface AIRecommendation {
  courseId: string;
  matchScore: number;
  reasons: string[];
}

interface AIRecommendationResponse {
  recommendations: AIRecommendation[];
  summary: string;
}

/**
 * POST /api/admin/finduniversity/ai/recommend
 *
 * Generate course recommendations based on user profile.
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await validateCSRFToken(request))) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body: RecommendRequest = await request.json();
    const { interests, currentEducation, careerGoals, preferences } = body;

    if (!interests || interests.length === 0) {
      return NextResponse.json(
        { error: 'At least one interest is required' },
        { status: 400 }
      );
    }

    // Build query to find relevant courses
    const whereConditions: Prisma.CourseWhereInput[] = [];

    // Filter by level if specified
    if (preferences?.level) {
      whereConditions.push({
        level: { contains: preferences.level, mode: 'insensitive' },
      });
    }

    // Filter by city if specified
    if (preferences?.city) {
      whereConditions.push({
        OR: [
          { city: { contains: preferences.city, mode: 'insensitive' } },
          { university: { city: { contains: preferences.city, mode: 'insensitive' } } },
        ],
      });
    }

    // Filter by modality if specified
    if (preferences?.modality) {
      whereConditions.push({
        modality: { contains: preferences.modality, mode: 'insensitive' },
      });
    }

    // Search by interests in course fields
    const interestConditions: Prisma.CourseWhereInput[] = interests.map((interest) => ({
      OR: [
        { name: { contains: interest, mode: 'insensitive' } },
        { area: { contains: interest, mode: 'insensitive' } },
        { subArea: { contains: interest, mode: 'insensitive' } },
        { description: { contains: interest, mode: 'insensitive' } },
        { tags: { contains: interest, mode: 'insensitive' } },
      ],
    }));

    whereConditions.push({ OR: interestConditions });

    // Fetch matching courses
    const courses = await prisma.course.findMany({
      where: whereConditions.length > 0 ? { AND: whereConditions } : {},
      include: {
        university: {
          select: {
            id: true,
            name: true,
            shortName: true,
            city: true,
            type: true,
          },
        },
      },
      take: 30,
    });

    if (courses.length === 0) {
      return NextResponse.json({
        recommendations: [],
        summary: 'Não foram encontrados cursos que correspondam aos seus interesses e preferências.',
        totalResults: 0,
      });
    }

    // Prepare courses for AI analysis
    const coursesForAI = courses.map((c) => ({
      id: c.id,
      name: c.name,
      level: c.level,
      area: c.area || undefined,
      subArea: c.subArea || undefined,
      description: c.description || undefined,
      city: c.city || undefined,
      modality: c.modality || undefined,
      price: c.price || undefined,
      universityName: c.university.name,
    }));

    // Get AI recommendations
    const prompt = getRecommendationPrompt(
      { interests, currentEducation, careerGoals, preferences },
      coursesForAI
    );

    const { content } = await callAIWithTracking(prompt, 'finduniversity-recommend', {
      maxTokens: 2000,
      temperature: 0.5,
      metadata: {
        interestsCount: interests.length,
        coursesAnalyzed: courses.length,
      },
    });

    // Parse AI response
    let aiResponse: AIRecommendationResponse;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found');
      }
      aiResponse = JSON.parse(jsonMatch[0]);
    } catch {
      // Fallback response
      aiResponse = {
        recommendations: courses.slice(0, 5).map((c) => ({
          courseId: c.id,
          matchScore: 70,
          reasons: ['Corresponde aos seus interesses'],
        })),
        summary: 'Aqui estão alguns cursos que podem interessar-lhe.',
      };
    }

    // Map recommendations to full course data
    const courseMap = new Map(courses.map((c) => [c.id, c]));
    const recommendations = aiResponse.recommendations
      .filter((r) => courseMap.has(r.courseId))
      .map((r) => {
        const course = courseMap.get(r.courseId)!;
        return {
          course: {
            id: course.id,
            name: course.name,
            level: course.level,
            area: course.area,
            subArea: course.subArea,
            duration: course.duration,
            modality: course.modality,
            city: course.city,
            price: course.price,
            university: course.university,
          },
          matchScore: Math.min(100, Math.max(0, r.matchScore)),
          reasons: r.reasons,
        };
      });

    return NextResponse.json({
      recommendations,
      summary: aiResponse.summary,
      totalResults: recommendations.length,
      profile: {
        interests,
        currentEducation,
        careerGoals,
        preferences,
      },
    });
  } catch (error) {
    console.error('Recommendation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}
