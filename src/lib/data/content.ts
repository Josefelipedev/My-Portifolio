// Content data layer (migration Phase 4). Each function returns the
// @portfolio/shared contract type and switches source by env: the standalone
// API when NEXT_PUBLIC_API_BASE_URL is set, otherwise direct Prisma.
//
// The Prisma branch JSON round-trips its rows so dates serialize to ISO strings
// exactly like the API responses — the two sources are byte-for-byte
// interchangeable, and the split becomes a pure env flip.

import prisma from '@/lib/prisma';
import { getApi, isApiConfigured } from '@/lib/api-client';
import type { Project, Skill, Experience, Education } from '@portfolio/shared';

const asContract = <T>(rows: unknown): T => JSON.parse(JSON.stringify(rows)) as T;

export async function getProjects(): Promise<Project[]> {
  if (isApiConfigured()) return getApi().listProjects();
  const rows = await prisma.project.findMany({
    orderBy: [{ rank: 'asc' }, { featured: 'desc' }, { stars: 'desc' }, { createdAt: 'desc' }],
  });
  return asContract<Project[]>(rows);
}

export async function getSkills(): Promise<Skill[]> {
  if (isApiConfigured()) return getApi().listSkills();
  const rows = await prisma.skill.findMany({
    orderBy: [{ category: 'asc' }, { order: 'asc' }, { name: 'asc' }],
  });
  return asContract<Skill[]>(rows);
}

export async function getExperiences(): Promise<Experience[]> {
  if (isApiConfigured()) return getApi().listExperiences();
  const rows = await prisma.experience.findMany({
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
  });
  return asContract<Experience[]>(rows);
}

export async function getEducation(): Promise<Education[]> {
  if (isApiConfigured()) return getApi().listEducation();
  const rows = await prisma.education.findMany({
    orderBy: [{ startDate: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }],
  });
  return asContract<Education[]>(rows);
}
