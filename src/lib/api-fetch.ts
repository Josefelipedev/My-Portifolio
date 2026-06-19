// Client-side API base-URL resolution (migration Phase 4).
//
// When NEXT_PUBLIC_API_BASE_URL is set (post-split), admin fetches go to the
// standalone API with credentials; when unset, paths stay relative (same-origin
// — current monolith behaviour). This is the single chokepoint the admin's
// fetch calls route through.

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');

/** Prepend the API base URL to an absolute "/api/..." path (no-op when unset). */
export function apiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${API_BASE}${path}`;
}

// The API enforces CSRF (double-submit cookie) on every state-changing request.
// Cross-origin, the cookie alone is not enough — the matching token must also
// ride as the x-csrf-token header. GET /api/csrf sets the cookie and returns the
// token; we fetch it once and reuse it (the cookie lives 24h).
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
let csrfTokenCache: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfTokenCache) return csrfTokenCache;
  const res = await fetch(apiUrl('/api/csrf'), { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to get CSRF token');
  const { csrfToken } = (await res.json()) as { csrfToken: string };
  csrfTokenCache = csrfToken;
  return csrfToken;
}

/**
 * fetch() against the API: resolves the base URL, sends cookies cross-origin,
 * and attaches the CSRF token for state-changing methods so the API's
 * double-submit check passes.
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (UNSAFE_METHODS.has(method) && !headers.has('x-csrf-token')) {
    try {
      headers.set('x-csrf-token', await getCsrfToken());
    } catch {
      // Let the request proceed; the API returns 403 and the caller surfaces it.
    }
  }
  return fetch(apiUrl(path), { credentials: 'include', ...options, headers });
}
