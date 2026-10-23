# Job Search — Implementation Status

Last updated: 2026-10-23

## Current status

The high-impact application workflow is implemented, validated and committed
(2026-10-23), rebased onto the Muse-Glimmer model switch. It is not deployed yet.

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
- `npm run test:run`: 187 tests pass
- `npm run build`: pass
- `npx prisma validate`: pass
- `git diff --check`: pass

## Required before production use

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
