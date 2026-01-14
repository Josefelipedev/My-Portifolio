import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { fetchRepoByFullName, fetchRepoReadme, fetchRepoLanguages } from '@/lib/github';
import { generateProjectSummary } from '@/lib/claude';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    // Check authentication
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { repoFullName, generateSummary = false } = body;

    if (!repoFullName) {
      return NextResponse.json({ error: 'repoFullName is required' }, { status: 400 });
    }

    // Fetch repo details
    const repo = await fetchRepoByFullName(repoFullName);

    // Check if already imported
    const existing = await prisma.project.findUnique({
      where: { githubId: repo.id },
    });

    if (existing) {
      return NextResponse.json({ error: 'Repository already imported', project: existing }, { status: 409 });
    }

    // Prepare project data
    let aiSummary: string | null = null;
    let aiSummarizedAt: Date | null = null;

    if (generateSummary) {
      const [owner, repoName] = repoFullName.split('/');
      const readme = await fetchRepoReadme(owner, repoName);
      const languages = await fetchRepoLanguages(owner, repoName);

      aiSummary = await generateProjectSummary({
        repoName: repo.name,
        description: repo.description,
        readme,
        languages: Object.keys(languages),
        topics: repo.topics,
      });
      aiSummarizedAt = new Date();
    }

    // Create project
    const project = await prisma.project.create({
      data: {
        title: repo.name,
        description: repo.description || 'No description provided',
        technologies: repo.topics.length > 0 ? repo.topics.join(',') : repo.language || '',
        repoUrl: repo.html_url,
        demoUrl: repo.homepage || null,
        githubId: repo.id,
        source: 'github',
        stars: repo.stargazers_count,
        aiSummary,
        aiSummarizedAt,
      },
    });

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error('Error importing GitHub repo:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import repository' },
      { status: 500 }
    );
  }
}
