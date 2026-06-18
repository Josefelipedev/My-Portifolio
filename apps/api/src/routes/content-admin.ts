// Authenticated content mutations — ported from the web app's POST/PUT/DELETE
// handlers under src/app/api/{projects,skills,experiences,education}. Every
// route here mutates, so the whole router is guarded by requireAuth +
// requireCsrf. Paths keep parity with the web (POST /api/projects, etc.).
//
// Faithful port of the create/update logic (incl. the project "top-3 rank"
// reordering). One intentional consistency fix: update/delete on a missing id
// returns 404 for all four domains (the web returned 404 only for skills and
// 500 for the others) — success-path behaviour is unchanged.

import { Hono } from 'hono';
import prisma from '../db';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';

const router = new Hono<AuthEnv>();

// requireAuth + requireCsrf are applied per-route (not as a wildcard
// `use('*')`, which would also intercept unmatched /api/* paths and 401 them
// before the app's 404 handler).

const SKILL_CATEGORIES = ['frontend', 'backend', 'devops', 'tools', 'other'];
const badRequest = (message: string) => ({ error: message, code: 'BAD_REQUEST' });
const notFound = (message: string) => ({ error: message, code: 'NOT_FOUND' });

// ---------------- Projects ----------------
router.post('/projects', requireAuth, requireCsrf, async (c) => {
  const data = (await c.req.json()) as Record<string, unknown>;
  const { rank, ...projectData } = data as { rank?: number } & Record<string, unknown>;

  if (rank && rank >= 1 && rank <= 3) {
    await prisma.project.updateMany({ where: { rank }, data: { rank: null } });
    projectData.rank = rank;
    projectData.featured = true;
  }
  const project = await prisma.project.create({ data: projectData as never });
  return c.json(project, 201);
});

router.put('/projects/:id', requireAuth, requireCsrf, async (c) => {
  const id = c.req.param('id');
  const data = (await c.req.json()) as Record<string, unknown>;
  const { rank, ...updateData } = data as { rank?: number | null } & Record<string, unknown>;

  if (rank !== undefined) {
    if (rank && rank >= 1 && rank <= 3) {
      await prisma.project.updateMany({
        where: { rank, id: { not: id } },
        data: { rank: null },
      });
      updateData.rank = rank;
      updateData.featured = true;
    } else {
      updateData.rank = null;
    }
  }
  try {
    const project = await prisma.project.update({ where: { id }, data: updateData as never });
    return c.json(project);
  } catch {
    return c.json(notFound('Project not found'), 404);
  }
});

router.delete('/projects/:id', requireAuth, requireCsrf, async (c) => {
  try {
    await prisma.project.delete({ where: { id: c.req.param('id') } });
    return c.body(null, 204);
  } catch {
    return c.json(notFound('Project not found'), 404);
  }
});

// ---------------- Skills ----------------
router.post('/skills', requireAuth, requireCsrf, async (c) => {
  const data = (await c.req.json()) as Record<string, unknown>;
  if (!data.name || !data.category) return c.json(badRequest('name and category are required'), 400);
  if (!SKILL_CATEGORIES.includes(String(data.category))) {
    return c.json(badRequest(`category must be one of: ${SKILL_CATEGORIES.join(', ')}`), 400);
  }
  const level = data.level as number | undefined;
  if (level !== undefined && (level < 1 || level > 5)) {
    return c.json(badRequest('level must be between 1 and 5'), 400);
  }
  const skill = await prisma.skill.create({
    data: {
      name: String(data.name),
      category: String(data.category),
      level: (data.level as number) || 3,
      iconUrl: (data.iconUrl as string) || null,
      order: (data.order as number) || 0,
    },
  });
  return c.json(skill, 201);
});

router.put('/skills/:id', requireAuth, requireCsrf, async (c) => {
  const id = c.req.param('id');
  const data = (await c.req.json()) as Record<string, unknown>;
  if (data.category && !SKILL_CATEGORIES.includes(String(data.category))) {
    return c.json(badRequest(`category must be one of: ${SKILL_CATEGORIES.join(', ')}`), 400);
  }
  const level = data.level as number | undefined;
  if (level !== undefined && (level < 1 || level > 5)) {
    return c.json(badRequest('level must be between 1 and 5'), 400);
  }
  try {
    const skill = await prisma.skill.update({ where: { id }, data: data as never });
    return c.json(skill);
  } catch {
    return c.json(notFound('Skill not found'), 404);
  }
});

router.delete('/skills/:id', requireAuth, requireCsrf, async (c) => {
  try {
    await prisma.skill.delete({ where: { id: c.req.param('id') } });
    return c.body(null, 204);
  } catch {
    return c.json(notFound('Skill not found'), 404);
  }
});

// ---------------- Experiences ----------------
router.post('/experiences', requireAuth, requireCsrf, async (c) => {
  const data = (await c.req.json()) as never;
  const experience = await prisma.experience.create({ data });
  return c.json(experience, 201);
});

router.put('/experiences/:id', requireAuth, requireCsrf, async (c) => {
  const id = c.req.param('id');
  const data = (await c.req.json()) as never;
  try {
    const experience = await prisma.experience.update({ where: { id }, data });
    return c.json(experience);
  } catch {
    return c.json(notFound('Experience not found'), 404);
  }
});

router.delete('/experiences/:id', requireAuth, requireCsrf, async (c) => {
  try {
    await prisma.experience.delete({ where: { id: c.req.param('id') } });
    return c.body(null, 204);
  } catch {
    return c.json(notFound('Experience not found'), 404);
  }
});

// ---------------- Education ----------------
router.post('/education', requireAuth, requireCsrf, async (c) => {
  const data = (await c.req.json()) as never;
  const education = await prisma.education.create({ data });
  return c.json(education, 201);
});

router.put('/education/:id', requireAuth, requireCsrf, async (c) => {
  const id = c.req.param('id');
  const data = (await c.req.json()) as never;
  try {
    const education = await prisma.education.update({ where: { id }, data });
    return c.json(education);
  } catch {
    return c.json(notFound('Education not found'), 404);
  }
});

router.delete('/education/:id', requireAuth, requireCsrf, async (c) => {
  try {
    await prisma.education.delete({ where: { id: c.req.param('id') } });
    return c.body(null, 204);
  } catch {
    return c.json(notFound('Education not found'), 404);
  }
});

export default router;
