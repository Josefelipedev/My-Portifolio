// Adapt the shared cookie-config (lowercase sameSite) to Hono's setCookie
// options (capitalized sameSite). Keeps the cross-origin env behaviour
// (AUTH_COOKIE_DOMAIN / AUTH_COOKIE_SAMESITE) consistent with the web side.

import type { CookieOptions } from 'hono/utils/cookie';
import { buildCookieOptions, type CookieDefaults } from './cookie-config';

const SAME_SITE = { strict: 'Strict', lax: 'Lax', none: 'None' } as const;

export function honoCookieOptions(defaults: CookieDefaults): CookieOptions {
  const o = buildCookieOptions(defaults);
  const options: CookieOptions = {
    httpOnly: o.httpOnly,
    secure: o.secure,
    sameSite: SAME_SITE[o.sameSite],
    path: o.path,
  };
  if (o.maxAge !== undefined) options.maxAge = o.maxAge;
  if (o.domain) options.domain = o.domain;
  return options;
}
