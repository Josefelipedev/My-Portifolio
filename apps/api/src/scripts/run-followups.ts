// CLI entry for the VPS cron: emails a daily digest of due/overdue follow-ups.
// Invoke once a day with: docker exec portfolio-api npm run followups:run

import { sendFollowupReminders } from '../lib/jobs/followup-reminders';

(async () => {
  const result = await sendFollowupReminders();
  console.log(`[followups] ${result.count} due/overdue, emailed: ${result.emailed}`);
  process.exit(0);
})().catch((e) => {
  console.error('[followups] runner failed:', e);
  process.exit(1);
});
