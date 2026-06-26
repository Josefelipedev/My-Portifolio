// Seeds the CompanyPortal table from the curated PT IT consultancy list
// (src/data/pt-consultancies.json). Idempotent: matches existing rows by
// careersUrl, updates their portalType/slug/filters, and never flips an
// operator's isActive toggle on re-seed. New rows are created with the
// entry's `active` flag.
//
// Run: npm run seed:consultancies   (from apps/api, or via docker exec)

import prisma from '../db';
import seed from '../data/pt-consultancies.json';

interface TitleFilters {
  include: string[];
  exclude: string[];
  location?: string[];
}

interface SeedPortal {
  company: string;
  careersUrl: string;
  portalType: string;
  portalSlug: string | null;
  active?: boolean;
  titleFilters?: TitleFilters;
  // Per-entry location allow-list merged onto the default filters (for
  // country-blind ATSs like Greenhouse/Lever that need PT-only filtering).
  location?: string[];
}

(async () => {
  const defaultFilters = seed.defaultTitleFilters as TitleFilters;
  const portals = seed.portals as SeedPortal[];

  let created = 0;
  let updated = 0;

  for (const p of portals) {
    const base = p.titleFilters ?? defaultFilters;
    const filters = JSON.stringify(p.location ? { ...base, location: p.location } : base);
    const existing = await prisma.companyPortal.findFirst({
      where: { careersUrl: p.careersUrl },
      select: { id: true },
    });

    if (existing) {
      await prisma.companyPortal.update({
        where: { id: existing.id },
        data: {
          company: p.company,
          portalType: p.portalType,
          portalSlug: p.portalSlug,
          titleFilters: filters,
          // isActive intentionally NOT touched — preserve operator's choice.
        },
      });
      updated++;
      console.log(`  ~ updated  ${p.company} [${p.portalType}]`);
    } else {
      await prisma.companyPortal.create({
        data: {
          company: p.company,
          careersUrl: p.careersUrl,
          portalType: p.portalType,
          portalSlug: p.portalSlug,
          titleFilters: filters,
          isActive: p.active ?? true,
        },
      });
      created++;
      console.log(`  + created  ${p.company} [${p.portalType}]${p.active === false ? ' (inactive)' : ''}`);
    }
  }

  console.log(`\n[seed:consultancies] ${created} created, ${updated} updated, ${portals.length} total.`);
  process.exit(0);
})().catch((e) => {
  console.error('[seed:consultancies] failed:', e);
  process.exit(1);
});
