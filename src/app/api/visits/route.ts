import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

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
        page: '/',
        referrer,
        userAgent,
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
