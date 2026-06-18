import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Public-safe fields only. Never expose secrets (wakatimeConfig, jobApiKeys)
// through this endpoint — GET is unauthenticated and consumed by the public site.
const PUBLIC_PROFILE_SELECT = {
  id: true,
  name: true,
  title: true,
  bio: true,
  avatarUrl: true,
  githubUrl: true,
  linkedinUrl: true,
  twitterUrl: true,
  email: true,
  location: true,
} as const;

export async function GET() {
  try {
    const siteConfig = await prisma.siteConfig.findUnique({
      where: { id: 'main' },
      select: PUBLIC_PROFILE_SELECT,
    });

    return NextResponse.json({ success: true, data: siteConfig });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, title, bio, avatarUrl, githubUrl, linkedinUrl, twitterUrl, email, location } = body;

    const siteConfig = await prisma.siteConfig.upsert({
      where: { id: 'main' },
      update: {
        name: name || undefined,
        title: title || undefined,
        bio: bio || null,
        avatarUrl: avatarUrl || null,
        githubUrl: githubUrl || null,
        linkedinUrl: linkedinUrl || null,
        twitterUrl: twitterUrl || null,
        email: email || null,
        location: location || null,
      },
      create: {
        id: 'main',
        name: name || 'Portfolio',
        title: title || 'Full Stack Developer',
        bio: bio || null,
        avatarUrl: avatarUrl || null,
        githubUrl: githubUrl || null,
        linkedinUrl: linkedinUrl || null,
        twitterUrl: twitterUrl || null,
        email: email || null,
        location: location || null,
      },
      select: PUBLIC_PROFILE_SELECT,
    });

    return NextResponse.json({ success: true, data: siteConfig });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
