# @portfolio/api

Node/Hono API service for the portfolio. It runs in Docker on the VPS and owns
the Node-only workloads: Prisma/PostgreSQL, e-mail, job aggregation and AI.

## Status

Production backend. The frontend resolves `/api/*` through
`NEXT_PUBLIC_API_BASE_URL`, with credentialed CORS and shared CSRF/auth cookies.
The deploy workflow rebuilds this service after validation and syncs the schema
with `prisma db push` (production has not been baselined for `prisma migrate deploy` yet).

The API includes portfolio content, authentication, analytics, knowledge-base,
job search, the ingested job feed, alerts, saved jobs, applications and versioned
application packages (tailored CV, cover letter, independent review and ATS
verification).

## Run locally

```bash
npm run dev --workspace @portfolio/api   # tsx watch on PORT (default 4000)
curl localhost:4000/health
```

## Job feed (cron)

`src/lib/jobs/feed.ts` ingests postings from the aggregator sources into
`JobPosting` (deduplicated across sources and runs), embeds each one once and
stores a 0-100 match score against the resume. Two CLI entries are meant for the
VPS crontab:

```bash
docker exec portfolio-api npm run jobs:ingest   # every few hours
docker exec portfolio-api npm run jobs:digest   # daily e-mail of the best new postings
```

Embeddings default to Ollama (`EMBED_PROVIDER=ollama` when `OLLAMA_URL` is set)
with `qwen3-embedding:0.6b` (`OLLAMA_EMBED_MODEL`); pull it once with
`ollama pull qwen3-embedding:0.6b`. Tunables: `JOBS_INGEST_COUNTRIES`
(default `pt,remote`), `JOBS_INGEST_MAX_QUERIES` (6), `JOBS_STALE_DAYS` (10),
`JOBS_DIGEST_SIZE` (5), `JOBS_DIGEST_MIN_SCORE` (60), `SITE_URL` (digest link).

## Shared contracts

Request/response schemas live in `@portfolio/shared` (`packages/shared`) and are
the single source of truth shared with the web frontend.
