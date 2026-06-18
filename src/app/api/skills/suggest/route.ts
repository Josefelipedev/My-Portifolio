import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { generateSkillsSuggestion, getCurrentAIProvider } from '@/lib/claude';
import { buildKnowledgeContext } from '@/lib/knowledge';

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

    // Pull verified facts from the private knowledge base (skill/tool/domain/language/certification).
    // Cap item count and per-item content length to keep the prompt (and token cost) bounded.
    const KNOWLEDGE_ITEM_LIMIT = 40;
    const KNOWLEDGE_CONTENT_CHARS = 400;
    const knowledgeItems = await prisma.knowledgeItem.findMany({
      where: {
        isActive: true,
        type: { in: ['skill', 'tool', 'domain', 'language', 'certification'] },
      },
      select: { type: true, title: true, content: true, tags: true, confidence: true, priority: true },
      orderBy: [{ priority: 'desc' }, { confidence: 'desc' }, { updatedAt: 'desc' }],
      take: KNOWLEDGE_ITEM_LIMIT,
    });
    const knowledgeContext =
      knowledgeItems.length > 0
        ? buildKnowledgeContext(
            knowledgeItems.map((item) => ({
              ...item,
              content: item.content.slice(0, KNOWLEDGE_CONTENT_CHARS),
            }))
          )
        : undefined;

    // Check if we have data to analyze
    if (projects.length === 0 && experiences.length === 0 && !knowledgeContext) {
      return NextResponse.json(
        {
          error: 'No projects, experiences or knowledge found. Add some projects, experiences or knowledge base items first to get skill suggestions.',
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
      knowledgeContext,
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
        knowledge: knowledgeItems.length,
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
