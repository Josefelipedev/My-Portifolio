import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { detectPortalType } from '@/lib/jobs/portal-scanner';

export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const portals = await prisma.companyPortal.findMany({
      orderBy: [{ isActive: 'desc' }, { company: 'asc' }],
    });

    return NextResponse.json(portals);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch portals' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { company, careersUrl, titleFilters } = body;

    if (!company || !careersUrl) {
      return NextResponse.json({ error: 'company and careersUrl are required' }, { status: 400 });
    }

    const detected = detectPortalType(careersUrl);
    const portalType = body.portalType || detected.type;
    const portalSlug = body.portalSlug || detected.slug;

    const portal = await prisma.companyPortal.create({
      data: {
        company,
        careersUrl,
        portalType,
        portalSlug,
        titleFilters: titleFilters ? JSON.stringify(titleFilters) : null,
      },
    });

    return NextResponse.json(portal, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create portal' }, { status: 500 });
  }
}
