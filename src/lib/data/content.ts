// Content data layer — API-only build (Cloudflare Pages). All reads go to the
// standalone API via the typed @portfolio/shared client; no Prisma in the edge
// bundle. NEXT_PUBLIC_API_BASE_URL must be set.

import { getApi } from '@/lib/api-client';
import type { Project, Skill, Experience, Education, Book, PublicSiteConfig } from '@portfolio/shared';

export async function getProjects(): Promise<Project[]> {
  return getApi().listProjects();
}

export async function getSkills(): Promise<Skill[]> {
  return getApi().listSkills();
}

export async function getExperiences(): Promise<Experience[]> {
  return getApi().listExperiences();
}

export async function getEducation(): Promise<Education[]> {
  return getApi().listEducation();
}

export async function getBooks(): Promise<Book[]> {
  return getApi().listBooks();
}

export async function getSiteConfig(): Promise<PublicSiteConfig | null> {
  return getApi().getSiteConfig();
}
