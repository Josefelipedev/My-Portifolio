// IT consultancies in Portugal to watch in the company tracker.
//
// "custom" pages render their openings as HTML links and are scanned; the
// "manual" ones load their list in the browser (or show no list at all), so
// they are kept as links to check by hand. Checked against the live pages on
// 2026-11-10.

import prisma from '../../db';
import type { TitleFilters } from './portal-scanner';

export interface ConsultancyPortal {
  company: string;
  careersUrl: string;
  portalType: 'custom' | 'manual';
}

export const CONSULTANCY_TITLE_FILTERS: TitleFilters = {
  include: [
    'node',
    'nest',
    'typescript',
    'javascript',
    'backend',
    'back-end',
    'back end',
    'fullstack',
    'full stack',
    'full-stack',
  ],
  exclude: ['principal', 'lead', 'manager', 'head of', 'architect', 'director'],
};

export const CONSULTANCY_PORTALS: ConsultancyPortal[] = [
  { company: 'KWAN', careersUrl: 'https://www.kwan.com/open-jobs', portalType: 'custom' },
  { company: 'Noesis', careersUrl: 'https://opportunities.noesis.pt/jobs', portalType: 'custom' },
  { company: 'Fyld', careersUrl: 'https://www.fyld.pt/it-jobs/', portalType: 'custom' },
  { company: 'Growin', careersUrl: 'https://www.growin.com/join-the-team-growin-careers/', portalType: 'custom' },
  { company: 'Wire IT', careersUrl: 'https://www.careers-page.com/wire-it', portalType: 'custom' },
  { company: 'HumanIT', careersUrl: 'https://www.careers-page.com/humanit', portalType: 'custom' },
  {
    company: 'Dellent',
    careersUrl: 'https://dellentconsulting.com/projetos/?modal=candidatura-espontanea',
    portalType: 'manual',
  },
  { company: 'Aubay', careersUrl: 'https://www.aubay.pt/carreira', portalType: 'manual' },
  { company: 'PrimeIT', careersUrl: 'https://www.primeit.pt/pt/carreiras', portalType: 'manual' },
  { company: 'Bee Engineering', careersUrl: 'https://www.bee-eng.pt/carreira', portalType: 'manual' },
  { company: 'Experis', careersUrl: 'https://www.experis.pt/pt/para-candidatos', portalType: 'manual' },
  {
    company: 'Mind Source',
    careersUrl: 'https://www.mindsource.pt/carreiras-empresas-tecnologia-portugal',
    portalType: 'manual',
  },
  { company: 'Olisipo', careersUrl: 'https://olisipo.pt/carreiras/', portalType: 'manual' },
  { company: 'Syone', careersUrl: 'https://www.syone.com/careers', portalType: 'manual' },
  { company: 'Affinity', careersUrl: 'https://affinity.pt/culture-people-at-affinity/', portalType: 'manual' },
  { company: 'Caixa Mágica', careersUrl: 'https://caixamagica.pt/careers/', portalType: 'manual' },
];

/**
 * Adds the consultancies that are not in the tracker yet, matched by company
 * name (case-insensitive) so a portal the user already added or edited is left
 * alone. Returns the companies it created.
 */
export async function seedConsultancyPortals(): Promise<string[]> {
  const existing = await prisma.companyPortal.findMany({ select: { company: true } });
  const known = new Set(existing.map((p) => p.company.toLowerCase()));

  const missing = CONSULTANCY_PORTALS.filter((p) => !known.has(p.company.toLowerCase()));
  if (missing.length === 0) return [];

  await prisma.companyPortal.createMany({
    data: missing.map((p) => ({
      company: p.company,
      careersUrl: p.careersUrl,
      portalType: p.portalType,
      titleFilters: JSON.stringify(CONSULTANCY_TITLE_FILTERS),
    })),
  });

  return missing.map((p) => p.company);
}
