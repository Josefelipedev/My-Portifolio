// Public content routes — ported from the web app's src/app/api/{projects,
// skills,experiences,education}/route.ts GET handlers. Query logic and ordering
// are kept identical; responses match the @portfolio/shared contracts.

import { Hono } from 'hono';
import prisma from '../db';

const content = new Hono();

// Mirrors withCacheHeaders(res, 60, 300) from the web api-utils.
const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

content.get('/projects', async (c) => {
  const projects = await prisma.project.findMany({
    orderBy: [
      { rank: 'asc' },
      { featured: 'desc' },
      { stars: 'desc' },
      { createdAt: 'desc' },
    ],
  });
  c.header('Cache-Control', CACHE_CONTROL);
  return c.json(projects);
});

content.get('/skills', async (c) => {
  const skills = await prisma.skill.findMany({
    orderBy: [{ category: 'asc' }, { order: 'asc' }, { name: 'asc' }],
  });
  c.header('Cache-Control', CACHE_CONTROL);
  return c.json(skills);
});

content.get('/experiences', async (c) => {
  const experiences = await prisma.experience.findMany({
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
  });
  c.header('Cache-Control', CACHE_CONTROL);
  return c.json(experiences);
});

content.get('/education', async (c) => {
  const education = await prisma.education.findMany({
    orderBy: [{ startDate: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }],
  });
  c.header('Cache-Control', CACHE_CONTROL);
  return c.json(education);
});

export default content;
