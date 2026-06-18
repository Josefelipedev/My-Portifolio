// Builds the Hono app (routes, CORS, error handling) and exports it without
// binding a port — so it can be unit-tested via app.fetch() and served by
// index.ts. Importing './env' first guarantees env is loaded before db.ts
// reads DATABASE_URL.

import './env';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { apiErrorSchema } from '@portfolio/shared';
import { ApiError } from './lib/api-utils';
import content from './routes/content';
import profile from './routes/profile';
import contact from './routes/contact';
import books from './routes/books';
import github from './routes/github';
import wakatime from './routes/wakatime';
import admin from './routes/admin';
import contentAdmin from './routes/content-admin';
import contentImport from './routes/content-import';
import ai from './routes/ai';
import resume from './routes/resume';
import jobsSaved from './routes/jobs-saved';
import jobsApplications from './routes/jobs-applications';
import jobsMisc from './routes/jobs-misc';
import jobsAi from './routes/jobs-ai';
import jobsAiInline from './routes/jobs-ai-inline';
import knowledge from './routes/knowledge';
import adminObservability from './routes/admin-observability';
import auth from './routes/auth';

const app = new Hono();

// Env-driven credentialed CORS, mirroring the web middleware (Phase 3).
// No-op when CORS_ALLOWED_ORIGINS is empty.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(
  '*',
  cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
    credentials: true,
    allowHeaders: ['Content-Type', 'Accept', 'X-CSRF-Token', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.get('/health', (c) =>
  c.json({ status: 'ok', service: 'portfolio-api', ts: new Date().toISOString() }),
);

// Ported domains (Phase 2). Mounted under /api to match the web paths.
app.route('/api', auth); // public: csrf, login, verify, logout
app.route('/api', content);
app.route('/api', profile);
app.route('/api', contact);
app.route('/api', books);
app.route('/api', github);
app.route('/api', wakatime);
app.route('/api', admin); // authenticated demo routes (requireAuth + requireCsrf)
app.route('/api', contentAdmin); // authenticated content mutations (POST/PUT/DELETE)
app.route('/api', contentImport); // authenticated books update/delete + books/education bulk imports
app.route('/api', ai); // authenticated AI endpoints (skills/suggest, projects/analyze)
app.route('/api', resume); // authenticated resume PDF analysis
app.route('/api', jobsSaved); // jobs: saved-jobs CRUD + stats
app.route('/api', jobsApplications); // jobs: applications CRUD + bulk ops
app.route('/api', jobsMisc); // jobs: analytics, search history, alerts (base)
app.route('/api', jobsAi); // jobs: tailored-CV generation + job-fit analysis
app.route('/api', jobsAiInline); // jobs: inline AI (enrich, interview-prep, generate-email, extract)
app.route('/api', knowledge); // knowledge-base admin: items CRUD + sources + AI processing
app.route('/api', adminObservability); // admin observability: logs, ai-usage, agent-tracking, analytics, visits

// Phase 2 (remaining): jobs (enrich/interview-prep/generate-email/extract,
// alerts run/scheduled, search/scraping, api-keys), summarize, profile-sync,
// resume compare/sync, scraper-logs, github/wakatime admin.

app.notFound((c) =>
  c.json(apiErrorSchema.parse({ error: 'Not found', code: 'NOT_FOUND' }), 404),
);

app.onError((err, c) => {
  // Map thrown ApiError to its status + the shared error envelope.
  if (err instanceof ApiError) {
    return c.json(
      apiErrorSchema.parse({ error: err.message, code: err.code }),
      err.statusCode as ContentfulStatusCode,
    );
  }
  // eslint-disable-next-line no-console
  console.error('API error:', err);
  return c.json(
    apiErrorSchema.parse({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
    500,
  );
});

export default app;
