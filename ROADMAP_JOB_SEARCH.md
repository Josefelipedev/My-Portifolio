# Job Search — Implementation Status

Last updated: 2026-10-25

## Current status

The application workflow is deployed (2026-10-23). Job discovery is moving from
query-time fan-out to "ingest continuously, match locally": Phase 1 (the job
feed) is in production since 2026-10-24.

### Job feed — Phase 1 (2026-10-24)

- `JobPosting` / `JobIngestRun` tables: postings deduplicated across sources and
  runs by fingerprint, with `firstSeenAt` / `lastSeenAt` / `closedAt`.
- `npm run jobs:ingest` (cron): role preferences + resume queries across the
  existing sources, upsert, close postings unseen for `JOBS_STALE_DAYS`, embed new
  postings once and store a stable 0-100 `matchScore` plus deal-breaker hits.
- Embeddings moved to Ollama `qwen3-embedding:0.6b`: Together withdrew
  `multilingual-e5-large-instruct` from serverless, which had silently disabled
  the smart-search semantic re-rank. qwen3 ranked best of embeddinggemma,
  nomic-embed-text and qwen3 on 328 real postings; the score band (0.30-0.65)
  is calibrated on that set. Smart search reuses the feed's stored embeddings.
- `npm run jobs:digest` (cron): e-mails the top new postings (score >= 60).
- Admin "Feed" tab (default): filters, save to Saved Jobs, dismiss/restore,
  manual "Update now".
- Fixes found on the way: Jooble ignored the country (returned US postings),
  Net-Empregos was decoded as UTF-8 (broken accents), numeric HTML entities
  were left in titles.

Production: `qwen3-embedding:0.6b` is pulled into the VPS Ollama; crontab runs
`jobs:ingest` at 00:05/06:05/12:05/18:05 and `jobs:digest` at 08:30 in the
VPS timezone (Europe/Berlin, one hour ahead of Lisbon). First runs: 231
postings, ~1 min when nothing is new; embedding takes ~8 s per posting while
the VPS is loaded (load ~6-9 on 4 cores).

Source health (2026-10-25), from the first four production runs:

- Sources used to log a failure and return `[]`, so a broken source looked
  like one with no matches and `JobIngestRun.errors` stayed `null`. They now
  rethrow; the aggregator records them and the Feed tab shows them as
  "source issues".
- Jobicy failed every run with a 400: the API dropped `search`. It now uses
  `tag`, with `industry=dev` by default (`tag` alone also matches sales roles).
- BuscoJobs fails every run from the VPS: AWS WAF answers datacenter IPs with
  a 405 captcha on the whole domain. It works from a residential IP. The block
  is reported as such and the category pages are fetched once per run instead
  of once per query. Getting it back in production needs a residential proxy
  (or dropping the source).
- Adzuna has no credentials on the VPS (`ADZUNA_APP_ID` / `ADZUNA_APP_KEY`), so
  it is skipped. LinkedIn occasionally answers 429.

### Job feed — next phases

- Phase 2: company watchlist (PT / remote-EU) seeded from career-ops' list, plus
  Workable, SmartRecruiters, Recruitee, Personio and Teamtailor adapters.
- Phase 3: JobSpy (LinkedIn, Indeed, Google Jobs) in the Python scraper.
- Hard location filter from `preferredLocations` (Arbeitnow still brings
  on-site DACH roles); cross-source dedupe when companies are named differently.

### Completed

- Versioned application packages (`ApplicationPackage` and `ApplicationArtifact`).
- Immutable job snapshot for every prepared application version.
- Tailored CV, cover letter and application e-mail generation.
- Independent AI review with factual-grounding checks.
- Explicit trust boundary for untrusted job-posting content.
- Editable application-package modal in Saved Jobs.
- React PDF generation including selected projects and certifications.
- Server-side PDF text extraction with `unpdf`.
- ATS checks for page count, extractable text, contact details, broken glyphs and keyword coverage.
- Exact generated PDF archive plus SHA-256 metadata.
- Sent application packages become immutable.
- Explicit approval/send action in the package modal: sends the archived e-mail
  with the ATS-verified PDF attached (or records a portal submission), links the
  package to `JobApplication`, appends to the application timeline and archives
  the exact outbound message as a `sent_email` artifact.
- Interview preparation uses the archived CV, cover letter, review and application stage.
- Salary prompts no longer claim unverified market research.
- ResumeConfig is now the AI source of truth, with bundled JSON only as fallback.
- Career preferences: target roles, locations, work modes, industries, minimum salary, availability, writing style and deal-breakers.
- Preferences and deal-breakers affect smart-search scoring.
- Analytics for fit-score calibration against real interview outcomes.
- Recurring skill-gap ranking from analyzed jobs.
- Automatic CSRF token attachment for API mutations.
- CI validation gate: web typecheck, API typecheck, tests and production build.
- Production deploy still uses `prisma db push`: the prod DB has no
  `_prisma_migrations` rows, so `migrate deploy` would replay `init` and fail.
- README and API documentation updated.

### Validation completed

- `npm run typecheck`: pass
- `npm run typecheck --workspace @portfolio/api`: pass
- `npm run test:run`: 209 tests pass
- `npm run build`: pass
- `npx prisma validate`: pass
- `git diff --check`: pass

## Required before production use

Steps 1-2 are done. Steps 3-4 are still open: as of 2026-10-25 the production
DB has no `ApplicationPackage` rows.

1. Push `main` (triggers the deploy); `db push` creates the
   `ApplicationPackage` / `ApplicationArtifact` tables.
2. Deploy the frontend containing the new Prepare modal.
3. Prepare one real application and manually inspect the generated CV, letter,
   review report and ATS result.
4. Confirm SMTP is configured on the API host, then approve and send that
   application from the modal and check the archived `sent_email` artifact
   against what the recipient actually received.

## Remaining roadmap

### Next priority

- Add stage selection and interactive mock-interview sessions.
- Add a verified salary provider; never use an unsupported LLM estimate.
- Add a confirmed STAR-story bank with evidence references.
- Add learning-plan resources and time estimates to recurring skill gaps.
- Use outcome calibration to suggest scoring-weight changes, with user approval
  before applying them.

### Optional integrations

- Gmail read-only sync for interview/rejection/offer signals, always requiring
  confirmation before changing application status.
- Notion one-way pipeline view. This is low priority because the project already
  has a richer native dashboard.
- Configurable portal plugin contract. This is low priority while the existing
  17 sources cover the target markets.

### Maintenance

- Baseline prod migrations (`prisma migrate resolve --applied` for every
  existing migration after checking the schema matches), then switch the deploy
  to `prisma migrate deploy`.
- Rename the deprecated Next.js `middleware.ts` convention to `proxy.ts`.
- Add browser-level tests for preparing, editing and ATS-verifying a package.
- Consider object storage for PDFs if database size grows significantly.

## Resume point for the next session

Start by reading this file, checking `git status`, and running:

```bash
npm run typecheck
npm run typecheck --workspace @portfolio/api
npm run test:run
npm run build
```

The main implementation entry points are:

- `apps/api/src/lib/jobs/application-package.ts` (`sendApplicationPackage`)
- `apps/api/src/routes/jobs-application-packages.ts`
- `src/components/admin/jobs/ApplicationPackageModal.tsx`
- `prisma/migrations/20260828130000_add_application_packages/migration.sql`
