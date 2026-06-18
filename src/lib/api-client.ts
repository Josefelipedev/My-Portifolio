// Configured PortfolioApi for the web frontend (migration Phase 4).
//
// Reads NEXT_PUBLIC_API_BASE_URL. When it is set (post-split, e.g.
// "https://api.example.com") the data layer talks to the standalone API
// service; when it is unset the data layer falls back to direct Prisma, so the
// current monolith behaviour is unchanged.

import { createPortfolioApi, type PortfolioApi } from '@portfolio/shared';

let cached: PortfolioApi | null = null;

export function isApiConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);
}

export function getApi(): PortfolioApi {
  if (cached) return cached;
  cached = createPortfolioApi({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '',
    credentials: 'include',
  });
  return cached;
}
