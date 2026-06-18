// CSRF for the API service — double-submit cookie pattern, ported from the web
// middleware. For state-changing methods, the csrf_token cookie must equal the
// X-CSRF-Token header and be the expected 64-hex-char length. The cross-origin
// readiness (cookie Domain/SameSite) is handled at cookie-set time on the web
// side (Phase 3); here we only validate.

import { getCookie, setCookie } from 'hono/cookie';
import { randomBytes } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { honoCookieOptions } from './cookies';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const TOKEN_HEX_LENGTH = 64; // 32 bytes -> 64 hex chars
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Issue (or reuse) a CSRF token, setting the double-submit cookie. */
export function issueCsrfToken(c: Context): string {
  const existing = getCookie(c, CSRF_COOKIE);
  if (existing && existing.length === TOKEN_HEX_LENGTH) return existing;
  const token = randomBytes(32).toString('hex');
  setCookie(
    c,
    CSRF_COOKIE,
    token,
    honoCookieOptions({ secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 60 * 60 * 24 }),
  );
  return token;
}

/** Hono middleware: 403 on CSRF mismatch for state-changing methods. */
export const requireCsrf: MiddlewareHandler = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method.toUpperCase())) {
    await next();
    return;
  }
  const cookie = getCookie(c, CSRF_COOKIE);
  const header = c.req.header(CSRF_HEADER);
  if (!cookie || !header || cookie !== header || cookie.length !== TOKEN_HEX_LENGTH) {
    return c.json({ error: 'Invalid CSRF token', code: 'FORBIDDEN' }, 403);
  }
  await next();
};
