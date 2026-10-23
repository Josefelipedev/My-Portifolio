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

/**
 * fetch() against the API. State-changing requests automatically receive the
 * double-submit CSRF token, so callers cannot accidentally bypass the shared
 * security contract when moving between the same-origin and split API modes.
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !headers.has('x-csrf-token')) {
    const csrfResponse = await fetch(apiUrl('/api/csrf'), { credentials: 'include' });
    if (!csrfResponse.ok) throw new Error('Failed to obtain CSRF token');
    const data = await csrfResponse.json() as { csrfToken?: string };
    if (!data.csrfToken) throw new Error('CSRF endpoint returned no token');
    headers.set('x-csrf-token', data.csrfToken);
  }
  return fetch(apiUrl(path), { credentials: 'include', ...options, headers });
}
