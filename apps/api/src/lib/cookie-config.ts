// Centralized cookie options for auth/CSRF cookies.
//
// Migration Phase 3 (cross-origin auth): when the frontend (Cloudflare Pages)
// and the API (VPS) live on different subdomains, the auth/CSRF cookies must
// carry a parent Domain and an appropriate SameSite. These are driven by env
// so production behavior is UNCHANGED until the vars are set after the split:
//
//   AUTH_COOKIE_DOMAIN    e.g. ".example.com"  (omit -> host-only, as today)
//   AUTH_COOKIE_SAMESITE  "strict" | "lax" | "none"  (omit -> per-call default)
//
// Same-site subdomains (app.example.com <-> api.example.com share example.com)
// only need Domain=.example.com with SameSite=Lax/Strict. SameSite=None+Secure
// is required only when the origins are cross-site (e.g. *.pages.dev).

export type SameSite = 'strict' | 'lax' | 'none';

function readSameSiteEnv(): SameSite | undefined {
  const raw = process.env.AUTH_COOKIE_SAMESITE?.toLowerCase().trim();
  return raw === 'strict' || raw === 'lax' || raw === 'none' ? raw : undefined;
}

function readDomainEnv(): string | undefined {
  const raw = process.env.AUTH_COOKIE_DOMAIN?.trim();
  return raw ? raw : undefined;
}

export interface CookieDefaults {
  /** Per-call-site default SameSite, used when the env override is absent. */
  sameSite: SameSite;
  /** Per-call-site default Secure flag, used unless SameSite resolves to none. */
  secure: boolean;
  /** Cookie lifetime in seconds. Omit for a session cookie. */
  maxAge?: number;
  /** Defaults to "/". */
  path?: string;
}

export interface ResolvedCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: SameSite;
  path: string;
  maxAge?: number;
  domain?: string;
}

/**
 * Build cookie options from a call-site's defaults, applying env overrides.
 * When AUTH_COOKIE_DOMAIN / AUTH_COOKIE_SAMESITE are unset, the result is
 * identical to the call-site defaults (no behavior change).
 */
export function buildCookieOptions(defaults: CookieDefaults): ResolvedCookieOptions {
  const sameSite = readSameSiteEnv() ?? defaults.sameSite;
  const domain = readDomainEnv();
  // SameSite=None is only honored by browsers when Secure is also set.
  const secure = sameSite === 'none' ? true : defaults.secure;

  const options: ResolvedCookieOptions = {
    httpOnly: true,
    secure,
    sameSite,
    path: defaults.path ?? '/',
  };
  if (defaults.maxAge !== undefined) options.maxAge = defaults.maxAge;
  if (domain) options.domain = domain;
  return options;
}
