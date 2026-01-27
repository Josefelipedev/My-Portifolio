import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { callAIWithTracking } from '@/lib/claude';
import { getComparisonPrompt } from '@/lib/finduniversity/ai-prompts';
import { validateCSRFToken } from '@/lib/csrf';

interface CompareRequest {
  type: 'courses' | 'universities';
  ids: string[];
}

interface ComparisonCriteria {
  name: string;
  analysis: string;
  ranking: string[];
}

interface AIComparisonResponse {
  summary: string;
  criteria: ComparisonCriteria[];
  recommendation: string;
}

/**
 * POST /api/admin/finduniversity/ai/compare
 *
 * Compare courses or universities side-by-side with AI analysis.
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await validateCSRFToken(request))) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body: CompareRequest = await request.json();
    const { type, ids } = body;

    if (!type || !['courses', 'universities'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "courses" or "universities"' },
        { status: 400 }
      );
    }

    if (!ids || ids.length < 2 || ids.length > 5) {
      return NextResponse.json(
        { error: 'Must provide 2-5 IDs to compare' },
        { status: 400 }
      );
    }

    if (type === 'courses') {
      // Fetch courses to compare
      const courses = await prisma.course.findMany({
        where: { id: { in: ids } },
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
      });

      if (courses.length < 2) {
        return NextResponse.json(
          { error: 'At least 2 valid courses are required' },
          { status: 400 }
        );
      }

      // Prepare courses for AI comparison
      const coursesForAI = courses.map((c) => ({
        id: c.id,
        name: c.name,
        level: c.level,
        area: c.area || undefined,
        description: c.description || undefined,
        duration: c.duration || undefined,
        credits: c.credits || undefined,
        modality: c.modality || undefined,
        price: c.price || undefined,
        city: c.city || undefined,
        universityName: c.university.name,
        universityType: c.university.type || undefined,
      }));

      // Get AI comparison
      const prompt = getComparisonPrompt(coursesForAI);
      const { content } = await callAIWithTracking(prompt, 'finduniversity-compare', {
        maxTokens: 2000,
        temperature: 0.5,
        metadata: {
          type: 'courses',
          idsCount: ids.length,
        },
      });

      // Parse AI response
      let aiResponse: AIComparisonResponse;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found');
        }
        aiResponse = JSON.parse(jsonMatch[0]);
      } catch {
        aiResponse = {
          summary: 'Comparação dos cursos selecionados.',
          criteria: [],
          recommendation: 'Analise os detalhes de cada curso para tomar a melhor decisão.',
        };
      }

      return NextResponse.json({
        type: 'courses',
        comparison: aiResponse,
        items: courses.map((c) => ({
          id: c.id,
          name: c.name,
          level: c.level,
          area: c.area,
          duration: c.duration,
          credits: c.credits,
          modality: c.modality,
          price: c.price,
          city: c.city,
          university: c.university,
        })),
      });
    } else {
      // Fetch universities to compare
      const universities = await prisma.university.findMany({
        where: { id: { in: ids } },
        include: {
          _count: { select: { courses: true } },
        },
      });

      if (universities.length < 2) {
        return NextResponse.json(
          { error: 'At least 2 valid universities are required' },
          { status: 400 }
        );
      }

      // Get course level distribution for each university
      const universityStats = await Promise.all(
        universities.map(async (uni) => {
          const levelCounts = await prisma.course.groupBy({
            by: ['level'],
            where: { universityId: uni.id },
            _count: { id: true },
          });
          return {
            universityId: uni.id,
            coursesByLevel: Object.fromEntries(
              levelCounts.map((l) => [l.level, l._count.id])
            ),
          };
        })
      );

      // Build comparison data
      const comparisonData = universities.map((uni) => {
        const stats = universityStats.find((s) => s.universityId === uni.id);
        return {
          id: uni.id,
          name: uni.name,
          shortName: uni.shortName,
          city: uni.city,
          type: uni.type,
          coursesCount: uni._count.courses,
          coursesByLevel: stats?.coursesByLevel || {},
          website: uni.website,
        };
      });

      // Simple comparison without AI for universities (can be enhanced later)
      return NextResponse.json({
        type: 'universities',
        comparison: {
          summary: `Comparação entre ${universities.length} instituições de ensino superior.`,
          items: comparisonData,
        },
        items: universities.map((u) => ({
          id: u.id,
          name: u.name,
          shortName: u.shortName,
          city: u.city,
          type: u.type,
          coursesCount: u._count.courses,
          website: u.website,
        })),
      });
    }
  } catch (error) {
    console.error('Comparison error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Comparison failed' },
      { status: 500 }
    );
  }
}
