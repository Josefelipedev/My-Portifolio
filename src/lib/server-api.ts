// Server-side (RSC) fetch to the standalone API, forwarding the user's
// auth/CSRF cookies. Used by admin pages that render on the edge (Cloudflare
// Pages) and must reach the API for authenticated data.

import { cookies } from 'next/headers';

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');

/** Thrown when the API responds with a non-2xx status. Carries the HTTP
 *  status so callers can distinguish auth failures (401) from real errors. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    path: string
  ) {
    super(`API ${path} -> ${status}`);
    this.name = 'ApiError';
  }
}

export async function serverApiFetch<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${BASE}${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new ApiError(res.status, path);
  }
  return res.json() as Promise<T>;
}
