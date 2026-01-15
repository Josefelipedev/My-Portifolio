import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

// Parse user agent to extract device, browser, and OS info
function parseUserAgent(ua: string | null): { device: string; browser: string; os: string } {
  if (!ua) return { device: 'unknown', browser: 'unknown', os: 'unknown' };

  // Device detection
  let device = 'desktop';
  if (/mobile/i.test(ua)) device = 'mobile';
  else if (/tablet|ipad/i.test(ua)) device = 'tablet';

  // Browser detection
  let browser = 'unknown';
  if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua)) browser = 'Safari';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';

  // OS detection
  let os = 'unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';

  return { device, browser, os };
}

// GET - Retrieve current visit count
export async function GET() {
  try {
    const stats = await prisma.siteStats.findUnique({
      where: { id: 'main' },
    });

    return NextResponse.json({
      totalVisits: stats?.totalVisits || 0,
      uniqueVisits: stats?.uniqueVisits || 0,
    });
  } catch (error) {
    console.error('Error fetching visit stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

// POST - Register a new visit
export async function POST(request: NextRequest) {
  try {
    // Get or create visitor ID from cookie
    let visitorId = request.cookies.get('visitor_id')?.value;
    const isNewVisitor = !visitorId;

    if (!visitorId) {
      visitorId = uuidv4();
    }

    // Get request info
    const userAgent = request.headers.get('user-agent') || undefined;
    const referrer = request.headers.get('referer') || undefined;

    // Get IP address
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || realIp || undefined;

    // Parse user agent
    const { device, browser, os } = parseUserAgent(userAgent || null);

    // Get page from request body if provided
    let page = '/';
    try {
      const body = await request.json();
      page = body.page || '/';
    } catch {
      // No body provided, use default
    }

    // Check if this visitor has visited before (in last 24 hours to avoid duplicate counts on same session)
    const recentVisit = await prisma.pageView.findFirst({
      where: {
        visitorId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    // Register page view
    await prisma.pageView.create({
      data: {
        visitorId,
        page,
        referrer,
        userAgent,
        ipAddress,
        device,
        browser,
        os,
      },
    });

    // Update stats
    const stats = await prisma.siteStats.upsert({
      where: { id: 'main' },
      create: {
        id: 'main',
        totalVisits: 1,
        uniqueVisits: 1,
      },
      update: {
        totalVisits: { increment: 1 },
        // Only increment unique visits if new visitor or first visit in 24h
        ...(isNewVisitor || !recentVisit
          ? { uniqueVisits: { increment: 1 } }
          : {}),
      },
    });

    // Create response with visitor cookie
    const response = NextResponse.json({
      totalVisits: stats.totalVisits,
      uniqueVisits: stats.uniqueVisits,
      isNewVisitor: isNewVisitor || !recentVisit,
    });

    // Set visitor ID cookie (expires in 1 year)
    if (isNewVisitor) {
      response.cookies.set('visitor_id', visitorId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60, // 1 year
      });
    }

    return response;
  } catch (error) {
    console.error('Error registering visit:', error);
    return NextResponse.json(
      { error: 'Failed to register visit' },
      { status: 500 }
    );
  }
}
