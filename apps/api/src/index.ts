// Portfolio API service — Node, runs on the VPS (PM2).
//
// Migration Phase 2 target: the ~75 route handlers under the web app's
// src/app/api/* are ported here as Hono routes, reusing the Node-only libs
// (Prisma/pg, nodemailer, job scraping, AI) that cannot run on the edge.
//
// This skeleton exists so the monorepo structure is in place; it is NOT yet
// wired into the deploy. The web app still serves /api/* until the cutover.

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { apiErrorSchema } from '@portfolio/shared';

const app = new Hono();

app.get('/health', (c) =>
  c.json({ status: 'ok', service: 'portfolio-api', ts: new Date().toISOString() }),
);

// Shared error shape, kept identical to the web API (api-utils.error).
app.notFound((c) =>
  c.json(apiErrorSchema.parse({ error: 'Not found', code: 'NOT_FOUND' }), 404),
);

// Phase 2: mount the ported route modules here, e.g.
//   app.route('/api/projects', projectsRoute)
//   app.route('/api/skills', skillsRoute)

const port = Number(process.env.PORT ?? 4000);
serve({ fetch: app.fetch, port });
// eslint-disable-next-line no-console
console.log(`portfolio-api listening on :${port}`);

export default app;
