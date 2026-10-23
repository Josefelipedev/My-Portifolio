// CLI entry for the VPS cron: e-mails the best new job-feed postings.
// Invoke (e.g. daily) with: docker exec portfolio-api npm run jobs:digest

import { runDigest } from '../lib/jobs/feed';

(async () => {
  const { sent, emailed } = await runDigest();
  console.log(`[digest] ${sent} posting(s) sent, emailed ${emailed}`);
  process.exit(0);
})().catch((e) => {
  console.error('[digest] runner failed:', e);
  process.exit(1);
});
