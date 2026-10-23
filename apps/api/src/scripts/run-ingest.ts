// CLI entry for the VPS cron: one job-feed ingestion pass (collect, dedupe,
// close stale, embed + score). Invoke (e.g. every 6h) with:
//   docker exec portfolio-api npm run jobs:ingest

import { isIngestRunning, runIngest } from '../lib/jobs/feed';

(async () => {
  if (await isIngestRunning()) {
    console.log('[ingest] another run is in progress; skipping');
    process.exit(0);
  }
  const started = Date.now();
  const r = await runIngest();
  console.log(
    `[ingest] ${r.queries.length} queries, found ${r.found}, new ${r.created}, seen again ${r.updated}, ` +
      `closed ${r.closed}, scored ${r.scored} in ${Date.now() - started}ms`
  );
  for (const error of r.errors) console.log(`  - ${error}`);
  process.exit(0);
})().catch((e) => {
  console.error('[ingest] runner failed:', e);
  process.exit(1);
});
