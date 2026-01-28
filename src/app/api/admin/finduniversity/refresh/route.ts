import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { validateCSRFToken } from '@/lib/csrf';
import { callAIWithTracking } from '@/lib/claude';
import { getDataExtractionPrompt } from '@/lib/finduniversity/ai-prompts';

type SourceType = 'auto' | 'sourceUrl' | 'officialUrl' | 'researchUrl' | 'custom';

interface RefreshRequest {
  courseId: string;
  useAI?: boolean;
  source?: SourceType;
  customUrl?: string;
}

interface BatchRefreshRequest {
  courseIds: string[];
  useAI?: boolean;
  source?: SourceType;
}

interface DocumentLink {
  name: string;
  url: string;
  type: string;
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
  applicationUrl: string | null;
  documents: DocumentLink[] | null;
  confidence: number;
}

async function fetchAndExtractCourseData(
  courseId: string,
  sourceUrl: string,
  useAI: boolean
): Promise<{
  success: boolean;
  courseId: string;
  extracted?: CourseExtraction;
  error?: string;
  fieldsUpdated?: number;
}> {
  try {
    // Fetch webpage content
    const response = await fetch(sourceUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return {
        success: false,
        courseId,
        error: `Failed to fetch URL: ${response.status}`,
      };
    }

    const html = await response.text();

    // Extract text content from HTML
    const pageContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!useAI) {
      // Without AI, just mark as "accessed" by updating updatedAt
      await prisma.course.update({
        where: { id: courseId },
        data: { updatedAt: new Date() },
      });

      return {
        success: true,
        courseId,
        fieldsUpdated: 0,
      };
    }

    // Use AI to extract data
    const prompt = getDataExtractionPrompt(pageContent, 'course');
    const { content } = await callAIWithTracking(prompt, 'finduniversity-extract', {
      maxTokens: 1000,
      temperature: 0.3,
      metadata: { courseId, sourceUrl },
    });

    // Parse AI response
    let extracted: CourseExtraction;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found');
      }
      extracted = JSON.parse(jsonMatch[0]);
    } catch {
      return {
        success: false,
        courseId,
        error: 'Failed to parse extracted data',
      };
    }

    // Update course with extracted data
    const updateData: Record<string, unknown> = {};

    if (extracted.credits !== null) updateData.credits = extracted.credits;
    if (extracted.duration !== null) updateData.duration = extracted.duration;
    if (extracted.durationMonths !== null) updateData.durationMonths = extracted.durationMonths;
    if (extracted.price !== null) updateData.price = extracted.price;
    if (extracted.applicationDeadline !== null)
      updateData.applicationDeadline = extracted.applicationDeadline;
    if (extracted.startDate !== null) updateData.startDate = extracted.startDate;
    if (extracted.requirements !== null) updateData.requirements = extracted.requirements;
    if (extracted.language !== null) updateData.language = extracted.language;
    if (extracted.applicationUrl !== null) updateData.applicationUrl = extracted.applicationUrl;
    if (extracted.documents !== null) updateData.documents = JSON.stringify(extracted.documents);

    const fieldsUpdated = Object.keys(updateData).length;

    if (fieldsUpdated > 0) {
      await prisma.course.update({
        where: { id: courseId },
        data: updateData,
      });
    }

    return {
      success: true,
      courseId,
      extracted,
      fieldsUpdated,
    };
  } catch (error) {
    return {
      success: false,
      courseId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * POST /api/admin/finduniversity/refresh
 *
 * Refresh course data from source URL using AI extraction.
 * Supports both single and batch refresh.
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await validateCSRFToken(request))) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();

    // Check if it's a batch request
    if (body.courseIds && Array.isArray(body.courseIds)) {
      const { courseIds, useAI = true } = body as BatchRefreshRequest;

      if (courseIds.length === 0) {
        return NextResponse.json({ error: 'No course IDs provided' }, { status: 400 });
      }

      if (courseIds.length > 10) {
        return NextResponse.json(
          { error: 'Maximum 10 courses per batch to avoid timeouts' },
          { status: 400 }
        );
      }

      // Fetch courses with their URLs
      const courses = await prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: {
          id: true,
          name: true,
          sourceUrl: true,
          officialUrl: true,
        },
      });

      const results = [];
      const errors = [];

      for (const course of courses) {
        const url = course.officialUrl || course.sourceUrl;

        if (!url) {
          errors.push({
            courseId: course.id,
            name: course.name,
            error: 'No source URL available',
          });
          continue;
        }

        const result = await fetchAndExtractCourseData(course.id, url, useAI);

        if (result.success) {
          results.push({
            courseId: result.courseId,
            name: course.name,
            fieldsUpdated: result.fieldsUpdated,
            confidence: result.extracted?.confidence,
          });
        } else {
          errors.push({
            courseId: result.courseId,
            name: course.name,
            error: result.error,
          });
        }

        // Small delay between requests to be respectful
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      return NextResponse.json({
        success: true,
        refreshed: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // Single course refresh
    const { courseId, useAI = true, source = 'auto', customUrl } = body as RefreshRequest;

    if (!courseId) {
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
    }

    // Validate custom URL if provided
    if (source === 'custom') {
      if (!customUrl) {
        return NextResponse.json({ error: 'Custom URL is required when source is "custom"' }, { status: 400 });
      }
      try {
        new URL(customUrl);
      } catch {
        return NextResponse.json({ error: 'Invalid custom URL format' }, { status: 400 });
      }
    }

    // Fetch course with URLs
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        university: {
          select: { id: true, name: true, website: true },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Determine which URL to use based on source parameter
    let url: string | null = null;
    // Access researchUrl safely (may not exist if schema not updated)
    const researchUrl = (course as { researchUrl?: string | null }).researchUrl;

    switch (source) {
      case 'custom':
        url = customUrl || null;
        break;
      case 'sourceUrl':
        url = course.sourceUrl;
        break;
      case 'officialUrl':
        url = course.officialUrl;
        break;
      case 'researchUrl':
        url = researchUrl || null;
        break;
      case 'auto':
      default:
        // Auto: prefer researchUrl, then officialUrl, fallback to sourceUrl
        url = researchUrl || course.officialUrl || course.sourceUrl;
        break;
    }

    if (!url) {
      return NextResponse.json({
        error: `No URL available for source "${source}"`,
        availableUrls: {
          sourceUrl: course.sourceUrl || null,
          officialUrl: course.officialUrl || null,
          researchUrl: researchUrl || null,
          universityWebsite: course.university?.website || null,
        }
      }, { status: 400 });
    }

    const result = await fetchAndExtractCourseData(course.id, url, useAI);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          course: { id: course.id, name: course.name },
        },
        { status: 400 }
      );
    }

    // Fetch updated course
    const updatedCourse = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        name: true,
        level: true,
        credits: true,
        duration: true,
        price: true,
        language: true,
        applicationDeadline: true,
        startDate: true,
        updatedAt: true,
        university: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      fieldsUpdated: result.fieldsUpdated,
      confidence: result.extracted?.confidence,
      extracted: result.extracted,
      course: updatedCourse,
      message: `Course "${course.name}" refreshed with ${result.fieldsUpdated} fields updated`,
    });
  } catch (error) {
    console.error('Error refreshing course:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh course' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/finduniversity/refresh
 *
 * List courses that need refresh (missing fields, old data, have URLs).
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // Courses with URLs but missing important fields
    const coursesNeedingRefresh = await prisma.course.findMany({
      where: {
        OR: [{ sourceUrl: { not: '' } }, { officialUrl: { not: '' } }],
        AND: [
          {
            OR: [
              { credits: null },
              { price: null },
              { duration: null },
              { language: null },
              { applicationDeadline: null },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        level: true,
        sourceUrl: true,
        officialUrl: true,
        credits: true,
        price: true,
        duration: true,
        language: true,
        applicationDeadline: true,
        updatedAt: true,
        university: {
          select: { id: true, name: true },
        },
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });

    // Count total courses needing refresh
    const totalNeedingRefresh = await prisma.course.count({
      where: {
        OR: [{ sourceUrl: { not: '' } }, { officialUrl: { not: '' } }],
        AND: [
          {
            OR: [
              { credits: null },
              { price: null },
              { duration: null },
              { language: null },
              { applicationDeadline: null },
            ],
          },
        ],
      },
    });

    // Count courses with URLs
    const totalWithUrls = await prisma.course.count({
      where: {
        OR: [{ sourceUrl: { not: '' } }, { officialUrl: { not: '' } }],
      },
    });

    // Count total courses
    const totalCourses = await prisma.course.count();

    // Group by missing fields
    const missingFieldStats = {
      credits: await prisma.course.count({ where: { credits: null } }),
      price: await prisma.course.count({ where: { price: null } }),
      duration: await prisma.course.count({ where: { duration: null } }),
      language: await prisma.course.count({ where: { language: null } }),
      applicationDeadline: await prisma.course.count({
        where: { applicationDeadline: null },
      }),
    };

    return NextResponse.json({
      courses: coursesNeedingRefresh,
      stats: {
        totalCourses,
        totalWithUrls,
        totalNeedingRefresh,
        missingFields: missingFieldStats,
      },
    });
  } catch (error) {
    console.error('Error fetching courses for refresh:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}
