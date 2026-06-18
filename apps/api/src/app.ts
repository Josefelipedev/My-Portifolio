// Builds the Hono app (routes, CORS, error handling) and exports it without
// binding a port — so it can be unit-tested via app.fetch() and served by
// index.ts. Importing './env' first guarantees env is loaded before db.ts
// reads DATABASE_URL.

import './env';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { apiErrorSchema } from '@portfolio/shared';
import content from './routes/content';
import profile from './routes/profile';
import contact from './routes/contact';
import books from './routes/books';
import github from './routes/github';
import wakatime from './routes/wakatime';
import admin from './routes/admin';

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
app.route('/api', admin); // authenticated routes (requireAuth + requireCsrf)

// Phase 2 (remaining): port the authenticated mutations/domains (projects/
// skills/experiences/education writes, jobs, ai, resume) under the admin group.

app.notFound((c) =>
  c.json(apiErrorSchema.parse({ error: 'Not found', code: 'NOT_FOUND' }), 404),
);

app.onError((err, c) => {
  // eslint-disable-next-line no-console
  console.error('API error:', err);
  return c.json(
    apiErrorSchema.parse({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
    500,
  );
});

export default app;
