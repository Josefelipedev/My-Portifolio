# @portfolio/api

Node API service for the portfolio, intended to run on the VPS (PM2). This is
the **Phase 2** target of the migration: the route handlers currently under the
web app's `src/app/api/*` will be ported here as [Hono](https://hono.dev) routes,
reusing the Node-only libraries (Prisma/pg, nodemailer, job scraping, AI) that
cannot run on the Cloudflare edge.

## Status

Skeleton only. **Not yet wired into the deploy** — the web app still serves
`/api/*` until the cutover. Cross-origin readiness (CORS + cookie domain) is
already in place behind env vars (see repo root `.env.example`, Phase 3).

## Run locally

```bash
npm run dev --workspace @portfolio/api   # tsx watch on PORT (default 4000)
curl localhost:4000/health
```

## Shared contracts

Request/response schemas live in `@portfolio/shared` (`packages/shared`) and are
the single source of truth shared with the web frontend.
