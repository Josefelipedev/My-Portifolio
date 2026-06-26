// Follow a company — add (or reactivate) a consultancy as an ACTIVE CompanyPortal
// so the portal scan tracks all of its jobs. Detects the ATS from the careers
// URL and VALIDATES it (must return at least one matching job) before saving, so
// we never start scanning a dead/wrong portal. Idempotent by careersUrl.
//
// Complements the discovery agent (which adds candidates as INACTIVE for review):
// this is the explicit "I want this company" path and goes straight to active.

import prisma from '../../db';
import { detectPortalType, fetchPortalJobs, type TitleFilters } from './portal-scanner';
import seed from '../../data/pt-consultancies.json';

const DEFAULT_FILTERS = seed.defaultTitleFilters as TitleFilters;

export interface FollowResult {
  ok: boolean;
  company: string;
  portalType?: string;
  jobs?: number;
  action?: 'created' | 'reactivated' | 'updated';
  reason?: string;
}

export async function followCompany(opts: {
  company: string;
  careersUrl: string;
  location?: string[];
  portalType?: string;
  portalSlug?: string;
}): Promise<FollowResult> {
  const { company, careersUrl } = opts;
  const detected = detectPortalType(careersUrl);
  const portalType = opts.portalType || detected.type;
  const portalSlug = opts.portalSlug ?? detected.slug;

  if (portalType === 'custom' && !opts.portalType) {
    // custom is allowed, but warn-by-validation below; still try.
  }

  const filters: TitleFilters = opts.location?.length
    ? { ...DEFAULT_FILTERS, location: opts.location }
    : DEFAULT_FILTERS;

  // Validate against the live ATS before persisting.
  let jobs: number;
  try {
    const found = await fetchPortalJobs({ portalType, portalSlug, careersUrl, company }, filters);
    jobs = found.length;
  } catch (e) {
    return { ok: false, company, portalType, reason: e instanceof Error ? e.message : 'fetch failed' };
  }
  if (jobs === 0) {
    return { ok: false, company, portalType, reason: 'ATS returned 0 matching jobs (check URL/slug/location)' };
  }

  const titleFilters = JSON.stringify(filters);
  const existing = await prisma.companyPortal.findFirst({
    where: { careersUrl },
    select: { id: true, isActive: true },
  });

  if (existing) {
    await prisma.companyPortal.update({
      where: { id: existing.id },
      data: { company, portalType, portalSlug, titleFilters, isActive: true },
    });
    return { ok: true, company, portalType, jobs, action: existing.isActive ? 'updated' : 'reactivated' };
  }

  await prisma.companyPortal.create({
    data: { company, careersUrl, portalType, portalSlug, titleFilters, isActive: true },
  });
  return { ok: true, company, portalType, jobs, action: 'created' };
}
