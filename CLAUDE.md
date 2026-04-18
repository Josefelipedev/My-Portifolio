# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build
npm start            # Run production server
npm run lint         # ESLint
npm run typecheck    # TypeScript check (no emit)

# Testing
npm test             # Vitest in watch mode
npm run test:run     # Single test run
npm run test:coverage

# Database
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to DB (dev)
npm run db:migrate   # Create migration
npm run db:migrate:deploy  # Deploy migrations (prod)
npm run db:seed      # Seed database
npm run db:reset     # Full DB reset
npm run db:studio    # Prisma Studio GUI

# Utilities
npm run sync:resume  # Sync skills from resume PDF
```

## Architecture

**Stack:** Next.js 16 App Router + React 19 + TypeScript (strict) + PostgreSQL/Prisma 7 + Tailwind CSS 4

**Path alias:** `@/*` → `./src/*`

### Data Flow

Content is database-driven (PostgreSQL via Prisma). The homepage (`src/app/page.tsx`) uses React Server Components to fetch from the DB, which pass data down to client components. External APIs (GitHub, WakaTime) are cached in the DB to avoid rate limits.

```
DB / External APIs → RSC (server fetch) → Client Components (interactivity)
```

Admin routes (`/admin/*`) are protected by JWT middleware and handle CRUD via API routes (`/api/*`).

### Key Directories

- `src/app/` — App Router pages and API routes; `admin/` is the protected dashboard
- `src/components/sections/` — Major homepage sections (Hero, Projects, Skills, Experience, Education, Contact)
- `src/components/ui/` — Reusable UI primitives (Modal, Toast, Navigation, ParticlesBackground)
- `src/components/admin/` — Admin dashboard components
- `src/lib/` — Server utilities: auth, AI, email, CSRF, audit logging, GitHub/WakaTime integrations
- `src/data/` — Static resume files (`resume.json`, `resume.pdf`)
- `prisma/` — Schema (18 models) and migration history

### Prisma Schema Model Groups

- **Content:** Project, Experience, Education, Skill, SiteConfig
- **Auth:** User, Session, VerificationCode, LoginHistory
- **Analytics:** SiteStats, PageView
- **Job search:** SavedJob, JobApplication, JobAlert, JobAlertMatch, JobSearchHistory
- **AI tracking:** AIUsageLog, AIUsageQuota
- **Caching:** GitHubRepoCache, WakaTimeYearCache
- **Security:** AuditLog, RateLimitEntry, SystemLog

### Security & Middleware

`src/middleware.ts` enforces JWT auth and CSRF validation. Protected routes: `/admin/*` and mutating API endpoints. Public routes: `/admin/login`, `/api/auth/login`.

Security headers (CSP, HSTS in prod, X-Frame-Options) are set in `next.config.js`.

### AI Integration

`src/lib/claude.ts` supports multiple providers: Together AI (primary), Ollama, Anthropic. Usage is tracked per-feature with token counts, cost, and quota limits (`AIUsageLog`, `AIUsageQuota` models).

### i18n

`src/lib/i18n.tsx` provides a `useLanguage()` hook for Portuguese (pt_BR) / English switching.

### Testing

Vitest with jsdom environment. Setup file at `src/__tests__/setup.ts`. Tests live alongside source or in `src/__tests__/`.
