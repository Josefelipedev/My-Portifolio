import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { generateSkillsSuggestion, getCurrentAIProvider } from '@/lib/claude';

export async function POST(request: Request) {
  try {
    // Check authentication
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { includeExisting = false } = body;

    // Fetch all projects
    const projects = await prisma.project.findMany({
      select: {
        title: true,
        description: true,
        technologies: true,
      },
    });

    // Fetch all experiences
    const experiences = await prisma.experience.findMany({
      select: {
        title: true,
        description: true,
        technologies: true,
      },
    });

    // Get existing skills to avoid duplicates
    let existingSkills: string[] = [];
    if (!includeExisting) {
      const skills = await prisma.skill.findMany({
        select: { name: true },
      });
      existingSkills = skills.map((s) => s.name.toLowerCase());
    }

    // Check if we have data to analyze
    if (projects.length === 0 && experiences.length === 0) {
      return NextResponse.json(
        {
          error: 'No projects or experiences found. Add some projects or experiences first to get skill suggestions.',
          suggestions: [],
        },
        { status: 400 }
      );
    }

    // Generate suggestions using AI
    const suggestions = await generateSkillsSuggestion({
      projects: projects.map((p) => ({
        title: p.title,
        description: p.description,
        technologies: p.technologies,
      })),
      experiences: experiences.map((e) => ({
        title: e.title,
        description: e.description,
        technologies: e.technologies,
      })),
      existingSkills,
    });

    // Filter out existing skills (case-insensitive)
    const filteredSuggestions = includeExisting
      ? suggestions
      : suggestions.filter(
          (s) => !existingSkills.includes(s.name.toLowerCase())
        );

    const provider = getCurrentAIProvider();

    return NextResponse.json({
      suggestions: filteredSuggestions,
      provider: provider.provider,
      analyzed: {
        projects: projects.length,
        experiences: experiences.length,
      },
    });
  } catch (error) {
    console.error('Error generating skill suggestions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
