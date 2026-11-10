// One-off CLI: adds the Portuguese IT consultancies to the company tracker.
// Safe to re-run; companies already in the tracker are skipped.
// Invoke with: docker exec portfolio-api npm run jobs:seed-portals

import { seedConsultancyPortals } from '../lib/jobs/consultancy-portals';

(async () => {
  const created = await seedConsultancyPortals();
  console.log(
    created.length > 0
      ? `[seed-portals] added ${created.length} portal(s): ${created.join(', ')}`
      : '[seed-portals] nothing to add; every consultancy is already tracked'
  );
  process.exit(0);
})().catch((e) => {
  console.error('[seed-portals] failed:', e);
  process.exit(1);
});
