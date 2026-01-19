import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { extractOwnerAndRepo, fetchRepoReadme, fetchRepoLanguages } from '@/lib/github';
import { generateProjectSummary } from '@/lib/claude';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    // Check authentication
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Fetch project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if we have a recent summary (less than 30 days old)
    if (project.aiSummarizedAt) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (project.aiSummarizedAt > thirtyDaysAgo) {
        return NextResponse.json({
          success: true,
          summary: project.aiSummary,
          cached: true,
          message: 'Using cached summary (less than 30 days old)',
        });
      }
    }

    // Parse repo URL to get owner and repo name (only if repoUrl exists)
    const repoInfo = project.repoUrl ? extractOwnerAndRepo(project.repoUrl) : null;

    let readme: string | null = null;
    let languages: string[] = [];

    if (repoInfo) {
      readme = await fetchRepoReadme(repoInfo.owner, repoInfo.repo);
      const languageData = await fetchRepoLanguages(repoInfo.owner, repoInfo.repo);
      languages = Object.keys(languageData);
    }

    // Generate summary
    const aiSummary = await generateProjectSummary({
      repoName: project.title,
      description: project.description,
      readme,
      languages,
      topics: project.technologies.split(',').map((t) => t.trim()),
    });

    // Update project with summary
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        aiSummary,
        aiSummarizedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      summary: aiSummary,
      cached: false,
      project: updatedProject,
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
