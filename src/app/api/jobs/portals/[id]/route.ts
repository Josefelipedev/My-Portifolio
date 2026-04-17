import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { detectPortalType } from '@/lib/jobs/portal-scanner';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const portal = await prisma.companyPortal.findUnique({ where: { id } });
    if (!portal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(portal);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch portal' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { company, careersUrl, isActive, titleFilters, portalType, portalSlug } = body;

    const updateData: Record<string, unknown> = {};
    if (company !== undefined) updateData.company = company;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (titleFilters !== undefined) updateData.titleFilters = JSON.stringify(titleFilters);

    if (careersUrl !== undefined) {
      updateData.careersUrl = careersUrl;
      const detected = detectPortalType(careersUrl);
      updateData.portalType = portalType || detected.type;
      updateData.portalSlug = portalSlug || detected.slug;
    } else {
      if (portalType !== undefined) updateData.portalType = portalType;
      if (portalSlug !== undefined) updateData.portalSlug = portalSlug;
    }

    const portal = await prisma.companyPortal.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(portal);
  } catch {
    return NextResponse.json({ error: 'Failed to update portal' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await prisma.companyPortal.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete portal' }, { status: 500 });
  }
}
