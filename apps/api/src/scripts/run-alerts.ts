// CLI entry for the VPS cron: runs every job alert that is currently due.
// Invoke (e.g. hourly) with: docker exec portfolio-api npm run alerts:run

import { runDueAlerts } from '../lib/jobs/alerts-runner';

(async () => {
  const started = Date.now();
  const results = await runDueAlerts();
  const totalNew = results.reduce((n, r) => n + r.newMatches, 0);
  const totalCvs = results.reduce((n, r) => n + r.cvsGenerated, 0);
  console.log(
    `[alerts] ran ${results.length} due alert(s), ${totalNew} new match(es), ${totalCvs} CV(s) generated in ${Date.now() - started}ms`
  );
  for (const r of results) {
    console.log(
      `  - ${r.name}: found ${r.found}, new ${r.newMatches}, cvs ${r.cvsGenerated}, emailed ${r.emailed}` +
        (r.error ? `, error: ${r.error}` : '')
    );
  }
  process.exit(0);
})().catch((e) => {
  console.error('[alerts] runner failed:', e);
  process.exit(1);
});
