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
import ai from './routes/ai';
import resume from './routes/resume';
import jobsSaved from './routes/jobs-saved';
import jobsApplications from './routes/jobs-applications';
import jobsMisc from './routes/jobs-misc';

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
app.route('/api', content);
app.route('/api', profile);
app.route('/api', contact);
app.route('/api', books);
app.route('/api', github);
app.route('/api', wakatime);
app.route('/api', admin); // authenticated demo routes (requireAuth + requireCsrf)
app.route('/api', contentAdmin); // authenticated content mutations (POST/PUT/DELETE)
app.route('/api', ai); // authenticated AI endpoints (skills/suggest, projects/analyze)
app.route('/api', resume); // authenticated resume PDF analysis
app.route('/api', jobsSaved); // jobs: saved-jobs CRUD + stats
app.route('/api', jobsApplications); // jobs: applications CRUD + bulk ops
app.route('/api', jobsMisc); // jobs: analytics, search history, alerts (base)

// Phase 2 (remaining): jobs (AI, alerts run/scheduled, search/scraping,
// api-keys), summarize, and the remaining admin/* domains.

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
