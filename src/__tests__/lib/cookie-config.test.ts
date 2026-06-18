import { describe, it, expect, afterEach } from 'vitest';
import { buildCookieOptions } from '@/lib/cookie-config';

const ORIGINAL = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('buildCookieOptions', () => {
  it('preserves call-site defaults when no env override is set (no behavior change)', () => {
    delete process.env.AUTH_COOKIE_DOMAIN;
    delete process.env.AUTH_COOKIE_SAMESITE;
    expect(buildCookieOptions({ sameSite: 'strict', secure: true, maxAge: 3600 })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 3600,
    });
  });

  it('adds Domain when AUTH_COOKIE_DOMAIN is set', () => {
    process.env.AUTH_COOKIE_DOMAIN = '.example.com';
    const opts = buildCookieOptions({ sameSite: 'lax', secure: true, maxAge: 60 });
    expect(opts.domain).toBe('.example.com');
  });

  it('overrides SameSite and forces Secure when set to none (required by browsers)', () => {
    process.env.AUTH_COOKIE_SAMESITE = 'none';
    const opts = buildCookieOptions({ sameSite: 'lax', secure: false, maxAge: 60 });
    expect(opts.sameSite).toBe('none');
    expect(opts.secure).toBe(true);
  });

  it('ignores an invalid SameSite env value', () => {
    process.env.AUTH_COOKIE_SAMESITE = 'banana';
    expect(buildCookieOptions({ sameSite: 'strict', secure: true }).sameSite).toBe('strict');
  });

  it('omits maxAge for session cookies', () => {
    delete process.env.AUTH_COOKIE_SAMESITE;
    expect('maxAge' in buildCookieOptions({ sameSite: 'strict', secure: true })).toBe(false);
  });
});
