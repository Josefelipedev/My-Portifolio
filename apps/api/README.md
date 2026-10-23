# @portfolio/api

Node/Hono API service for the portfolio. It runs in Docker on the VPS and owns
the Node-only workloads: Prisma/PostgreSQL, e-mail, job aggregation and AI.

## Status

Production backend. The frontend resolves `/api/*` through
`NEXT_PUBLIC_API_BASE_URL`, with credentialed CORS and shared CSRF/auth cookies.
The deploy workflow rebuilds this service after validation and syncs the schema
with `prisma db push` (production has not been baselined for `prisma migrate deploy` yet).

The API includes portfolio content, authentication, analytics, knowledge-base,
job search, alerts, saved jobs, applications and versioned application packages
(tailored CV, cover letter, independent review and ATS verification).

## Run locally

```bash
npm run dev --workspace @portfolio/api   # tsx watch on PORT (default 4000)
curl localhost:4000/health
```

## Shared contracts

Request/response schemas live in `@portfolio/shared` (`packages/shared`) and are
the single source of truth shared with the web frontend.
