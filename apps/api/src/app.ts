// Builds the Hono app (routes, CORS, error handling) and exports it without
// binding a port — so it can be unit-tested via app.fetch() and served by
// index.ts. Importing './env' first guarantees env is loaded before db.ts
// reads DATABASE_URL.

import './env';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { apiErrorSchema } from '@portfolio/shared';
import content from './routes/content';
import books from './routes/books';

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
app.route('/api', books);

// Phase 2 (remaining): auth, jobs, admin, ai, contact, github, wakatime…

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
