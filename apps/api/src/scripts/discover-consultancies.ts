// CLI for the consultancy discovery agent. Proposes new PT IT consultancies,
// validates them against their real ATS, and inserts survivors as INACTIVE
// CompanyPortal rows for review in /admin/jobs (toggle active to include in
// the scan). Safe to run periodically.
//
// Run: npm run consultancies:discover [count]

import { discoverConsultancies } from '../lib/jobs/consultancy-discovery';

(async () => {
  const count = parseInt(process.argv[2] || '20', 10);
  const started = Date.now();
  const r = await discoverConsultancies({ count });

  if (r.error) console.warn(`[discover] ${r.error}`);
  console.log(
    `[discover] proposed ${r.proposed}, added ${r.added.length} (inactive), skipped ${r.skipped.length} in ${Date.now() - started}ms`
  );
  for (const a of r.added) console.log(`  + ${a.company} [${a.portalType}] — ${a.jobs} job(s)`);
  for (const s of r.skipped) console.log(`  - ${s.company}: ${s.reason}`);

  if (r.added.length) {
    console.log('\nReview the new portals in /admin/jobs and set them active to include in the scan.');
  }
  process.exit(0);
})().catch((e) => {
  console.error('[discover] failed:', e);
  process.exit(1);
});
