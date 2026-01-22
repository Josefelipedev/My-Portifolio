import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getGitHubProfileReadme } from '@/lib/github-stats';

export async function POST() {
  try {
    // Fetch data from GitHub
    const githubData = await getGitHubProfileReadme();

    if (!githubData) {
      return NextResponse.json(
        { error: 'Failed to fetch GitHub profile data' },
        { status: 500 }
      );
    }

    const { user } = githubData;

    // Update or create SiteConfig with GitHub data
    const siteConfig = await prisma.siteConfig.upsert({
      where: { id: 'main' },
      update: {
        name: user.name,
        bio: user.bio || null,
        avatarUrl: user.avatar,
        githubUrl: `https://github.com/${user.login}`,
        email: user.email || undefined,
        location: user.location || undefined,
      },
      create: {
        id: 'main',
        name: user.name,
        title: 'Full Stack Developer',
        bio: user.bio || null,
        avatarUrl: user.avatar,
        githubUrl: `https://github.com/${user.login}`,
        email: user.email || undefined,
        location: user.location || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Profile synced from GitHub successfully',
      data: {
        siteConfig,
        readme: githubData.content ? true : false,
      },
    });
  } catch (error) {
    console.error('Profile sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync profile from GitHub' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get current SiteConfig
    const siteConfig = await prisma.siteConfig.findUnique({
      where: { id: 'main' },
    });

    // Get GitHub data for comparison
    const githubData = await getGitHubProfileReadme();

    return NextResponse.json({
      siteConfig,
      githubData: githubData ? {
        name: githubData.user.name,
        login: githubData.user.login,
        avatar: githubData.user.avatar,
        bio: githubData.user.bio,
        location: githubData.user.location,
        email: githubData.user.email,
        company: githubData.user.company,
        blog: githubData.user.blog,
        hasReadme: !!githubData.content,
      } : null,
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile data' },
      { status: 500 }
    );
  }
}
