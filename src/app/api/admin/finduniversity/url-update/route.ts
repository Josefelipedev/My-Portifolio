import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';

const SCRAPER_URL = process.env.SCRAPER_URL || 'http://localhost:8000';

interface ScrapedData {
  name?: string;
  description?: string;
  website?: string;
  city?: string;
  region?: string;
  email?: string;
  phone?: string;
  type?: string;
  logoUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  twitterUrl?: string;
  youtubeUrl?: string;
  // Course fields
  level?: string;
  area?: string;
  duration?: string;
  credits?: number;
  modality?: string;
  schedule?: string;
  language?: string;
  price?: string;
  applicationDeadline?: string;
}

/**
 * POST /api/admin/finduniversity/url-update
 *
 * Update a university or course by scraping data from a URL.
 * Requires authentication.
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url, type, universityId, courseId } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Call the scraper to extract data from URL
    let scrapedData: ScrapedData = {};
    try {
      // Use the existing /enrich/university endpoint to extract data
      const scraperEndpoint = `${SCRAPER_URL}/enrich/university?website_url=${encodeURIComponent(url)}&force=false`;

      const scraperResponse = await fetch(scraperEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (scraperResponse.ok) {
        const result = await scraperResponse.json();
        if (result.success && result.data) {
          // Map the enrichment data to our format
          scrapedData = {
            logoUrl: result.data.logo_url,
            email: result.data.email,
            phone: result.data.phone,
            description: result.data.description,
            instagramUrl: result.data.social_media_urls?.instagram,
            linkedinUrl: result.data.social_media_urls?.linkedin,
            facebookUrl: result.data.social_media_urls?.facebook,
            twitterUrl: result.data.social_media_urls?.twitter,
            youtubeUrl: result.data.social_media_urls?.youtube,
          };
        }
      }
    } catch (scraperError) {
      console.error('Scraper error:', scraperError);
      // Continue without scraped data - we'll use the URL itself
    }

    let result;
    let fieldsUpdated = 0;

    if (type === 'university') {
      // Try to find university by URL or ID
      let university = universityId
        ? await prisma.university.findUnique({ where: { id: universityId } })
        : await prisma.university.findFirst({
            where: {
              OR: [
                { website: { contains: new URL(url).hostname } },
                { sourceUrl: url },
              ],
            },
          });

      if (!university) {
        // Create new university if not found
        const slug = (scrapedData.name || new URL(url).hostname)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        university = await prisma.university.create({
          data: {
            name: scrapedData.name || new URL(url).hostname,
            slug,
            website: url,
            sourceUrl: url,
            description: scrapedData.description || null,
            city: scrapedData.city || null,
            region: scrapedData.region || null,
            email: scrapedData.email || null,
            phone: scrapedData.phone || null,
            type: scrapedData.type || null,
            logoUrl: scrapedData.logoUrl || null,
            instagramUrl: scrapedData.instagramUrl || null,
            linkedinUrl: scrapedData.linkedinUrl || null,
            facebookUrl: scrapedData.facebookUrl || null,
            twitterUrl: scrapedData.twitterUrl || null,
            youtubeUrl: scrapedData.youtubeUrl || null,
          },
        });
        fieldsUpdated = Object.keys(scrapedData).length;
        result = { type: 'university', name: university.name, fieldsUpdated, data: university, created: true };
      } else {
        // Update existing university
        const updateData: Record<string, unknown> = {};
        const updateFields = [
          'description', 'city', 'region', 'email', 'phone', 'type',
          'logoUrl', 'instagramUrl', 'linkedinUrl', 'facebookUrl', 'twitterUrl', 'youtubeUrl'
        ];

        for (const field of updateFields) {
          const key = field as keyof ScrapedData;
          if (scrapedData[key] && !university[field as keyof typeof university]) {
            updateData[field] = scrapedData[key];
            fieldsUpdated++;
          }
        }

        // Always update sourceUrl if different
        if (url !== university.sourceUrl) {
          updateData.sourceUrl = url;
        }

        if (Object.keys(updateData).length > 0) {
          university = await prisma.university.update({
            where: { id: university.id },
            data: updateData,
          });
        }

        result = { type: 'university', name: university.name, fieldsUpdated, data: university, created: false };
      }
    } else if (type === 'course') {
      // Try to find course by URL or ID
      let course = courseId
        ? await prisma.course.findUnique({ where: { id: courseId }, include: { university: true } })
        : await prisma.course.findFirst({
            where: {
              OR: [
                { officialUrl: url },
                { sourceUrl: url },
                { researchUrl: url },
              ],
            },
            include: { university: true },
          });

      if (!course) {
        return NextResponse.json(
          { error: 'Course not found. Please specify a course ID or use an existing course URL.' },
          { status: 404 }
        );
      }

      // Update course with scraped data
      const updateData: Record<string, unknown> = {};
      const courseFields = [
        'description', 'area', 'duration', 'credits', 'modality',
        'schedule', 'language', 'price', 'applicationDeadline'
      ];

      for (const field of courseFields) {
        const key = field as keyof ScrapedData;
        if (scrapedData[key] && !course[field as keyof typeof course]) {
          updateData[field] = scrapedData[key];
          fieldsUpdated++;
        }
      }

      // Update researchUrl if not set
      if (!course.researchUrl) {
        updateData.researchUrl = url;
      }

      if (Object.keys(updateData).length > 0) {
        course = await prisma.course.update({
          where: { id: course.id },
          data: updateData,
          include: { university: true },
        });
      }

      result = { type: 'course', name: course.name, fieldsUpdated, data: course, created: false };
    } else {
      return NextResponse.json({ error: 'Invalid type. Use "university" or "course".' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('URL update error:', error);
    return NextResponse.json(
      { error: 'Failed to update from URL' },
      { status: 500 }
    );
  }
}
