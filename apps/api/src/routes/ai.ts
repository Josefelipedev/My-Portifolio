// AI routes — ported from the web app's authenticated AI endpoints. Reuse the
// API-owned AI engine (lib/claude.ts + lib/ai-tracking.ts). All routes mutate /
// call paid AI, so they are guarded by requireAuth + requireCsrf.

import { Hono } from 'hono';
import prisma from '../db';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';
import {
  generateSkillsSuggestion,
  analyzeReadmeForProject,
  getCurrentAIProvider,
  generateProjectSummary,
} from '../lib/claude';
import { buildKnowledgeContext } from '../lib/knowledge';
import { extractOwnerAndRepo, fetchRepoReadme, fetchRepoLanguages } from '../lib/github';

const ai = new Hono<AuthEnv>();

// POST /api/summarize — AI summary for a project from its GitHub README +
// languages (cached 30 days on the Project). Ported from src/app/api/summarize.
ai.post('/summarize', requireAuth, requireCsrf, async (c) => {
  const { projectId } = (await c.req.json().catch(() => ({}))) as { projectId?: string };
  if (!projectId) return c.json({ error: 'projectId is required', code: 'BAD_REQUEST' }, 400);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return c.json({ error: 'Project not found', code: 'NOT_FOUND' }, 404);

  // Reuse a recent summary (< 30 days).
  if (project.aiSummarizedAt) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (project.aiSummarizedAt > thirtyDaysAgo) {
      return c.json({ success: true, summary: project.aiSummary, cached: true });
    }
  }

  const repoInfo = project.repoUrl ? extractOwnerAndRepo(project.repoUrl) : null;
  let readme: string | null = null;
  let languages: string[] = [];
  if (repoInfo) {
    readme = await fetchRepoReadme(repoInfo.owner, repoInfo.repo);
    languages = Object.keys(await fetchRepoLanguages(repoInfo.owner, repoInfo.repo));
  }

  const aiSummary = await generateProjectSummary({
    repoName: project.title,
    description: project.description,
    readme,
    languages,
    topics: project.technologies.split(',').map((t) => t.trim()),
  });

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { aiSummary, aiSummarizedAt: new Date() },
  });

  return c.json({ success: true, summary: aiSummary, cached: false, project: updated });
});

// POST /api/skills/suggest — suggest skills from projects/experiences + the
// private knowledge base. Ported from src/app/api/skills/suggest/route.ts.
ai.post('/skills/suggest', requireAuth, requireCsrf, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { includeExisting?: boolean };
  const includeExisting = body.includeExisting ?? false;

  const projects = await prisma.project.findMany({
    select: { title: true, description: true, technologies: true },
  });
  const experiences = await prisma.experience.findMany({
    select: { title: true, description: true, technologies: true },
  });

  let existingSkills: string[] = [];
  if (!includeExisting) {
    const skills = await prisma.skill.findMany({ select: { name: true } });
    existingSkills = skills.map((s) => s.name.toLowerCase());
  }

  const KNOWLEDGE_ITEM_LIMIT = 40;
  const KNOWLEDGE_CONTENT_CHARS = 400;
  const knowledgeItems = await prisma.knowledgeItem.findMany({
    where: { isActive: true, type: { in: ['skill', 'tool', 'domain', 'language', 'certification'] } },
    select: { type: true, title: true, content: true, tags: true, confidence: true, priority: true },
    orderBy: [{ priority: 'desc' }, { confidence: 'desc' }, { updatedAt: 'desc' }],
    take: KNOWLEDGE_ITEM_LIMIT,
  });
  const knowledgeContext =
    knowledgeItems.length > 0
      ? buildKnowledgeContext(
          knowledgeItems.map((item) => ({ ...item, content: item.content.slice(0, KNOWLEDGE_CONTENT_CHARS) })),
        )
      : undefined;

  if (projects.length === 0 && experiences.length === 0 && !knowledgeContext) {
    return c.json(
      {
        error:
          'No projects, experiences or knowledge found. Add some projects, experiences or knowledge base items first to get skill suggestions.',
        suggestions: [],
      },
      400,
    );
  }

  const suggestions = await generateSkillsSuggestion({
    projects: projects.map((p) => ({ title: p.title, description: p.description, technologies: p.technologies })),
    experiences: experiences.map((e) => ({ title: e.title, description: e.description, technologies: e.technologies })),
    existingSkills,
    knowledgeContext,
  });

  const filtered = includeExisting
    ? suggestions
    : suggestions.filter((s) => !existingSkills.includes(s.name.toLowerCase()));

  return c.json({
    suggestions: filtered,
    provider: getCurrentAIProvider().provider,
    analyzed: { projects: projects.length, experiences: experiences.length, knowledge: knowledgeItems.length },
  });
});

// POST /api/projects/analyze — analyze a README into project metadata.
// Ported from src/app/api/projects/analyze/route.ts.
ai.post('/projects/analyze', requireAuth, requireCsrf, async (c) => {
  const { readme, title, repoUrl } = (await c.req.json().catch(() => ({}))) as {
    readme?: string;
    title?: string;
    repoUrl?: string;
  };

  if (!readme || typeof readme !== 'string') {
    return c.json({ error: 'README content is required', code: 'BAD_REQUEST' }, 400);
  }
  if (readme.trim().length < 50) {
    return c.json({ error: 'README content is too short (minimum 50 characters)', code: 'BAD_REQUEST' }, 400);
  }

  const analysis = await analyzeReadmeForProject(readme, title);
  return c.json({
    suggestedTitle: analysis.suggestedTitle,
    suggestedDescription: analysis.suggestedDescription,
    detectedTechnologies: analysis.detectedTechnologies,
    aiSummary: analysis.aiSummary,
    repoUrl: repoUrl || null,
  });
});

export default ai;
