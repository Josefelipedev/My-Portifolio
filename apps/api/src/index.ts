// Portfolio API service entrypoint — Node, runs on the VPS (PM2).
//
// Migration Phase 2: route handlers from the web app's src/app/api/* are ported
// into ./app as Hono routes, reusing the Node-only libs (Prisma/pg, nodemailer,
// job scraping, AI) that cannot run on the edge.
//
// NOT yet wired into the deploy — the web app still serves /api/* until cutover.

import { serve } from '@hono/node-server';
import app from './app';

const port = Number(process.env.PORT ?? 4000);
serve({ fetch: app.fetch, port });
// eslint-disable-next-line no-console
console.log(`portfolio-api listening on :${port}`);
