// Server-side (RSC) fetch to the standalone API, forwarding the user's
// auth/CSRF cookies. Used by admin pages that render on the edge (Cloudflare
// Pages) and must reach the API for authenticated data.

import { cookies } from 'next/headers';

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');

export async function serverApiFetch<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${BASE}${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`API ${path} -> ${res.status}`);
  }
  return res.json() as Promise<T>;
}
