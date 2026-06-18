// CORS for the cross-origin API (migration Phase 3).
//
// Framework-agnostic (Web Request/Response) so the same logic works in the
// current Next middleware and in the future Hono API service.
//
// Driven by env; when CORS_ALLOWED_ORIGINS is empty the helper is a no-op,
// so same-origin production behavior is unchanged:
//
//   CORS_ALLOWED_ORIGINS = "https://app.example.com,https://example.pages.dev"
//
// Credentialed CORS (cookies) forbids the "*" origin, so we echo the request's
// Origin only when it is on the allowlist.

const ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Content-Type,Accept,X-CSRF-Token,Authorization';
const MAX_AGE = '86400'; // cache preflight for 24h

let cachedOrigins: string[] | null = null;

export function getAllowedOrigins(): string[] {
  if (cachedOrigins) return cachedOrigins;
  cachedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return cachedOrigins;
}

/** Test seam: reset the memoized allowlist (env changed). */
export function resetCorsCache(): void {
  cachedOrigins = null;
}

export function isOriginAllowed(origin: string | null | undefined): origin is string {
  if (!origin) return false;
  return getAllowedOrigins().includes(origin.replace(/\/+$/, ''));
}

/**
 * CORS headers to attach to an actual (non-preflight) response. Returns an
 * empty object when the origin is not allowed (or none configured).
 */
export function buildCorsHeaders(origin: string | null | undefined): Record<string, string> {
  if (!isOriginAllowed(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

/**
 * If the request is a CORS preflight for an allowed origin, return a 204
 * response with the preflight headers; otherwise return null (not a preflight
 * we handle).
 */
export function handlePreflight(request: Request): Response | null {
  if (request.method.toUpperCase() !== 'OPTIONS') return null;
  const origin = request.headers.get('origin');
  if (!isOriginAllowed(origin)) return null;

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': ALLOWED_METHODS,
      'Access-Control-Allow-Headers': ALLOWED_HEADERS,
      'Access-Control-Max-Age': MAX_AGE,
      Vary: 'Origin',
    },
  });
}
