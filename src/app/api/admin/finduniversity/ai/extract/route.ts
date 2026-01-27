import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { callAIWithTracking } from '@/lib/claude';
import { getDataExtractionPrompt } from '@/lib/finduniversity/ai-prompts';
import { validateCSRFToken } from '@/lib/csrf';

interface ExtractRequest {
  url: string;
  type: 'course' | 'university';
  entityId?: string;
  saveToDatabase?: boolean;
}

interface CourseExtraction {
  credits: number | null;
  duration: string | null;
  durationMonths: number | null;
  price: string | null;
  applicationDeadline: string | null;
  startDate: string | null;
  requirements: string | null;
  language: string | null;
  confidence: number;
}

interface UniversityExtraction {
  description: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  type: string | null;
  confidence: number;
}

/**
 * POST /api/admin/finduniversity/ai/extract
 *
 * Extract data from a webpage using AI.
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await validateCSRFToken(request))) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body: ExtractRequest = await request.json();
    const { url, type, entityId, saveToDatabase = false } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    if (!type || !['course', 'university'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "course" or "university"' },
        { status: 400 }
      );
    }

    // Fetch webpage content
    let pageContent: string;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status}`);
      }

      const html = await response.text();

      // Extract text content from HTML (simple approach)
      pageContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch (fetchError) {
      return NextResponse.json(
        {
          error:
            fetchError instanceof Error
              ? `Failed to fetch URL: ${fetchError.message}`
              : 'Failed to fetch URL',
        },
        { status: 400 }
      );
    }

    // Use AI to extract data
    const prompt = getDataExtractionPrompt(pageContent, type);
    const { content } = await callAIWithTracking(prompt, 'finduniversity-extract', {
      maxTokens: 1000,
      temperature: 0.3,
      metadata: { url, type, entityId },
    });

    // Parse AI response
    let extracted: CourseExtraction | UniversityExtraction;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found');
      }
      extracted = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse extracted data' },
        { status: 500 }
      );
    }

    // Optionally save to database
    if (saveToDatabase && entityId) {
      if (type === 'course') {
        const courseData = extracted as CourseExtraction;
        const updateData: Record<string, unknown> = {};

        if (courseData.credits !== null) updateData.credits = courseData.credits;
        if (courseData.duration !== null) updateData.duration = courseData.duration;
        if (courseData.durationMonths !== null)
          updateData.durationMonths = courseData.durationMonths;
        if (courseData.price !== null) updateData.price = courseData.price;
        if (courseData.applicationDeadline !== null)
          updateData.applicationDeadline = courseData.applicationDeadline;
        if (courseData.startDate !== null) updateData.startDate = courseData.startDate;
        if (courseData.requirements !== null)
          updateData.requirements = courseData.requirements;
        if (courseData.language !== null) updateData.language = courseData.language;

        if (Object.keys(updateData).length > 0) {
          await prisma.course.update({
            where: { id: entityId },
            data: updateData,
          });
        }
      } else {
        const uniData = extracted as UniversityExtraction;
        const updateData: Record<string, unknown> = {};

        if (uniData.description !== null) updateData.description = uniData.description;
        if (uniData.address !== null) updateData.address = uniData.address;
        if (uniData.email !== null) updateData.email = uniData.email;
        if (uniData.phone !== null) updateData.phone = uniData.phone;
        if (uniData.type !== null) updateData.type = uniData.type;

        if (Object.keys(updateData).length > 0) {
          await prisma.university.update({
            where: { id: entityId },
            data: updateData,
          });
        }
      }
    }

    // Get hostname from URL for source info
    let source: string;
    try {
      source = new URL(url).hostname;
    } catch {
      source = 'unknown';
    }

    return NextResponse.json({
      success: true,
      url,
      type,
      source,
      extracted,
      savedToDatabase: saveToDatabase && entityId ? true : false,
    });
  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Extraction failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/finduniversity/ai/extract
 *
 * Get entities with missing data that could benefit from extraction.
 */
export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find courses with official URLs but missing key data
    const coursesWithMissingData = await prisma.course.count({
      where: {
        officialUrl: { not: null },
        OR: [
          { credits: null },
          { price: null },
          { duration: null },
          { applicationDeadline: null },
        ],
      },
    });

    // Find universities with missing description
    const universitiesWithMissingData = await prisma.university.count({
      where: {
        OR: [{ description: null }, { email: null }, { phone: null }],
      },
    });

    // Get sample items for extraction
    const sampleCourses = await prisma.course.findMany({
      where: {
        officialUrl: { not: null },
        OR: [{ credits: null }, { price: null }],
      },
      select: {
        id: true,
        name: true,
        officialUrl: true,
        credits: true,
        price: true,
      },
      take: 5,
    });

    const sampleUniversities = await prisma.university.findMany({
      where: {
        description: null,
      },
      select: {
        id: true,
        name: true,
        sourceUrl: true,
      },
      take: 5,
    });

    return NextResponse.json({
      courses: {
        withMissingData: coursesWithMissingData,
        samples: sampleCourses,
      },
      universities: {
        withMissingData: universitiesWithMissingData,
        samples: sampleUniversities,
      },
    });
  } catch (error) {
    console.error('Extract stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
