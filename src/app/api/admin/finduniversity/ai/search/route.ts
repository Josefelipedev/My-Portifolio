import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { callAIWithTracking } from '@/lib/claude';
import { getSearchParsePrompt, getSearchExplanationPrompt } from '@/lib/finduniversity/ai-prompts';
import { validateCSRFToken } from '@/lib/csrf';
import { Prisma } from '@prisma/client';

interface SearchRequest {
  query: string;
}

interface ParsedSearch {
  level: string | null;
  area: string | null;
  city: string | null;
  modality: string | null;
  schedule: string | null;
  priceMax: number | null;
  keywords: string[];
}

/**
 * POST /api/admin/finduniversity/ai/search
 *
 * Smart search using natural language processing.
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await validateCSRFToken(request))) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body: SearchRequest = await request.json();
    const { query } = body;

    if (!query || query.trim().length < 3) {
      return NextResponse.json(
        { error: 'Query must be at least 3 characters' },
        { status: 400 }
      );
    }

    // Parse the natural language query with AI
    const parsePrompt = getSearchParsePrompt(query);
    const { content: parseResponse } = await callAIWithTracking(parsePrompt, 'finduniversity-search', {
      maxTokens: 300,
      temperature: 0.3,
      metadata: { query, action: 'parse' },
    });

    // Extract JSON from response
    let parsed: ParsedSearch;
    try {
      const jsonMatch = parseResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // Fallback to simple keyword search
      parsed = {
        level: null,
        area: null,
        city: null,
        modality: null,
        schedule: null,
        priceMax: null,
        keywords: query.split(' ').filter((w) => w.length > 2),
      };
    }

    // Build Prisma query based on parsed search
    const whereConditions: Prisma.CourseWhereInput[] = [];

    if (parsed.level) {
      whereConditions.push({
        level: { contains: parsed.level, mode: 'insensitive' },
      });
    }

    if (parsed.city) {
      whereConditions.push({
        OR: [
          { city: { contains: parsed.city, mode: 'insensitive' } },
          { university: { city: { contains: parsed.city, mode: 'insensitive' } } },
        ],
      });
    }

    if (parsed.modality) {
      whereConditions.push({
        modality: { contains: parsed.modality, mode: 'insensitive' },
      });
    }

    if (parsed.schedule) {
      whereConditions.push({
        schedule: { contains: parsed.schedule, mode: 'insensitive' },
      });
    }

    // Area/keywords search in multiple fields
    const searchTerms = [parsed.area, ...parsed.keywords].filter(Boolean) as string[];
    if (searchTerms.length > 0) {
      const searchConditions: Prisma.CourseWhereInput[] = searchTerms.map((term) => ({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { area: { contains: term, mode: 'insensitive' } },
          { subArea: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { tags: { contains: term, mode: 'insensitive' } },
        ],
      }));
      whereConditions.push({ OR: searchConditions });
    }

    // Execute search
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
      take: 50,
      orderBy: { name: 'asc' },
    });

    // Generate explanation
    const explanationPrompt = getSearchExplanationPrompt(query, parsed as unknown as Record<string, unknown>, courses.length);
    const { content: explanation } = await callAIWithTracking(
      explanationPrompt,
      'finduniversity-search',
      {
        maxTokens: 100,
        temperature: 0.5,
        metadata: { query, action: 'explain', resultsCount: courses.length },
      }
    );

    return NextResponse.json({
      query,
      interpreted: parsed,
      explanation,
      totalResults: courses.length,
      courses: courses.map((c) => ({
        id: c.id,
        name: c.name,
        level: c.level,
        area: c.area,
        subArea: c.subArea,
        duration: c.duration,
        modality: c.modality,
        city: c.city,
        price: c.price,
        university: c.university,
      })),
    });
  } catch (error) {
    console.error('Smart search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
