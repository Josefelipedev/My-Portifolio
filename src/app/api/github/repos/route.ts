import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { fetchUserRepos } from '@/lib/github';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    // Check authentication
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('per_page') || '30');

    // Fetch repos from GitHub
    const repos = await fetchUserRepos(page, perPage);

    // Get already imported repo IDs
    const importedProjects = await prisma.project.findMany({
      where: { githubId: { not: null } },
      select: { githubId: true },
    });
    const importedIds = new Set(importedProjects.map((p) => p.githubId));

    // Mark repos that are already imported
    const reposWithStatus = repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      html_url: repo.html_url,
      homepage: repo.homepage,
      language: repo.language,
      topics: repo.topics,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      updated_at: repo.updated_at,
      isImported: importedIds.has(repo.id),
    }));

    // Cache repos in database
    for (const repo of repos) {
      await prisma.gitHubRepoCache.upsert({
        where: { id: repo.id },
        create: {
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description,
          htmlUrl: repo.html_url,
          homepage: repo.homepage,
          language: repo.language,
          topics: repo.topics.join(','),
          stargazers: repo.stargazers_count,
          forksCount: repo.forks_count,
          updatedAt: new Date(repo.updated_at),
        },
        update: {
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description,
          htmlUrl: repo.html_url,
          homepage: repo.homepage,
          language: repo.language,
          topics: repo.topics.join(','),
          stargazers: repo.stargazers_count,
          forksCount: repo.forks_count,
          updatedAt: new Date(repo.updated_at),
          cachedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ repos: reposWithStatus });
  } catch (error) {
    console.error('Error fetching GitHub repos:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch repos' },
      { status: 500 }
    );
  }
}
