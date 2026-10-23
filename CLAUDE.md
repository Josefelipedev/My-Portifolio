# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

**Stack:** Next.js 16 App Router + React 19 + TypeScript (strict) + PostgreSQL/Prisma 7 + Tailwind CSS 4

### Data Flow

Content is database-driven (PostgreSQL via Prisma). The homepage (`src/app/page.tsx`) uses React Server Components to fetch from the DB, which pass data down to client components. External APIs (GitHub, WakaTime) are cached in the DB to avoid rate limits.

```
DB / External APIs → RSC (server fetch) → Client Components (interactivity)
```

Admin routes (`/admin/*`) are protected by JWT middleware and handle CRUD via API routes (`/api/*`).

### Security & Middleware

`src/middleware.ts` enforces JWT auth and CSRF validation. Protected routes: `/admin/*` and mutating API endpoints. Public routes: `/admin/login`, `/api/auth/login`.

Security headers (CSP, HSTS in prod, X-Frame-Options) are set in `next.config.js`.

### AI Integration

`src/lib/claude.ts` supports multiple providers: Together AI (primary), Ollama, Anthropic. Usage is tracked per-feature with token counts, cost, and quota limits (`AIUsageLog`, `AIUsageQuota` models).
