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

/** fetch() against the API: resolves the base URL and sends cookies cross-origin. */
export function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(apiUrl(path), { credentials: 'include', ...options });
}
