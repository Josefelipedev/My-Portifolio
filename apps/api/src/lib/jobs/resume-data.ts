import prisma from '../../db';
import bundledResume from '../../../data/resume.json';

export interface CareerPreferences {
  targetRoles: string[];
  preferredLocations: string[];
  workModes: string[];
  minimumSalary: string;
  dealBreakers: string[];
  preferredIndustries: string[];
  availability: string;
  writingStyle: string;
}

export type FullResumeData = typeof bundledResume & { preferences?: CareerPreferences };

/**
 * The Resume tab writes ResumeConfig. AI features must read that same source;
 * the bundled JSON is only a safe fallback for first-run and deployments that
 * have not created ResumeConfig yet.
 */
export async function loadFullResumeData(): Promise<FullResumeData> {
  const config = await prisma.resumeConfig.findUnique({ where: { id: 'main' } });
  if (!config?.data) return structuredClone(bundledResume);
  try {
    return JSON.parse(config.data) as FullResumeData;
  } catch {
    return structuredClone(bundledResume);
  }
}
