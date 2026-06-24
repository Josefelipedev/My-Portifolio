// Jobs AI — tailored-CV generation and job-fit analysis. Ported from the web
// handlers under src/app/api/jobs/{saved/[id]/generate-cv, batch/generate-cv,
// analyze, batch/analyze}. The heavy lifting lives in the ported libs
// (lib/jobs/cv-generator, lib/jobs/ai-analysis). All routes are authenticated
// mutations (call paid AI + write the DB), so guarded by requireAuth + requireCsrf.

import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';
import { generateCustomCV } from '../lib/jobs/cv-generator';
import { analyzeJob } from '../lib/jobs/ai-analysis';
import { parseBody } from '../lib/api-utils';
import { analyzeSchema, batchCvSchema, batchAnalyzeSchema } from '../schemas/jobs';

const jobsAi = new Hono<AuthEnv>();

// Mirrors the web handlers' message-based status mapping.
function statusForError(message: string): ContentfulStatusCode {
  if (message.includes('quota')) return 429;
  if (message.includes('not found')) return 404;
  if (message.includes('not configured')) return 503;
  return 500;
}
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Unknown error');

// POST /api/jobs/saved/:id/generate-cv
jobsAi.post('/jobs/saved/:id/generate-cv', requireAuth, requireCsrf, async (c) => {
  try {
    const customCV = await generateCustomCV(c.req.param('id'));
    return c.json({ success: true, customCV });
  } catch (e) {
    return c.json({ error: msg(e), code: 'AI_ERROR' }, statusForError(msg(e)));
  }
});

// POST /api/jobs/batch/generate-cv
jobsAi.post('/jobs/batch/generate-cv', requireAuth, requireCsrf, async (c) => {
  const { jobIds } = await parseBody(c, batchCvSchema);

  const results = await Promise.allSettled(jobIds.map((id) => generateCustomCV(id)));
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;
  const errors = results
    .map((r, i) => (r.status === 'rejected' ? { jobId: jobIds[i], error: msg(r.reason) } : null))
    .filter(Boolean);
  const cvData = results.map((r, i) => ({
    jobId: jobIds[i],
    success: r.status === 'fulfilled',
    customCV: r.status === 'fulfilled' ? r.value : null,
    error: r.status === 'rejected' ? msg(r.reason) : null,
  }));

  return c.json({ success: true, processed: jobIds.length, succeeded, failed, errors, cvData });
});

// POST /api/jobs/analyze
jobsAi.post('/jobs/analyze', requireAuth, requireCsrf, async (c) => {
  const { jobId } = await parseBody(c, analyzeSchema);
  try {
    const analyzedAt = new Date().toISOString();
    const analysis = await analyzeJob(jobId);
    return c.json({ success: true, analysis, analyzedAt });
  } catch (e) {
    return c.json({ error: msg(e), code: 'AI_ERROR' }, statusForError(msg(e)));
  }
});

// POST /api/jobs/batch/analyze
jobsAi.post('/jobs/batch/analyze', requireAuth, requireCsrf, async (c) => {
  const { jobIds } = await parseBody(c, batchAnalyzeSchema);

  const results = await Promise.allSettled(jobIds.map((id) => analyzeJob(id)));
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;
  const errors = results
    .map((r, i) => (r.status === 'rejected' ? { jobId: jobIds[i], error: msg(r.reason) } : null))
    .filter(Boolean);

  return c.json({ success: true, processed: jobIds.length, succeeded, failed, errors });
});

export default jobsAi;
