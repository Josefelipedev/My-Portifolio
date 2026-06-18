import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import {
  isOriginAllowed,
  buildCorsHeaders,
  handlePreflight,
  resetCorsCache,
} from '@/lib/cors';

const ORIGINAL = { ...process.env };

beforeEach(() => resetCorsCache());
afterEach(() => {
  process.env = { ...ORIGINAL };
  resetCorsCache();
});

function req(method: string, origin?: string): Request {
  const headers = new Headers();
  if (origin) headers.set('origin', origin);
  return new Request('https://api.example.com/api/projects', { method, headers });
}

describe('cors (no env = no-op)', () => {
  it('disallows everything and emits no headers when unconfigured', () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    resetCorsCache();
    expect(isOriginAllowed('https://app.example.com')).toBe(false);
    expect(buildCorsHeaders('https://app.example.com')).toEqual({});
    expect(handlePreflight(req('OPTIONS', 'https://app.example.com'))).toBeNull();
  });
});

describe('cors (configured)', () => {
  beforeEach(() => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com, https://example.pages.dev';
    resetCorsCache();
  });

  it('allows a listed origin and echoes it with credentials', () => {
    expect(isOriginAllowed('https://app.example.com')).toBe(true);
    expect(buildCorsHeaders('https://app.example.com')).toMatchObject({
      'Access-Control-Allow-Origin': 'https://app.example.com',
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin',
    });
  });

  it('rejects an unlisted origin', () => {
    expect(isOriginAllowed('https://evil.com')).toBe(false);
    expect(buildCorsHeaders('https://evil.com')).toEqual({});
  });

  it('answers preflight for an allowed origin with 204 + methods/headers', async () => {
    const res = handlePreflight(req('OPTIONS', 'https://app.example.com'));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(204);
    expect(res!.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    expect(res!.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res!.headers.get('Access-Control-Allow-Headers')).toContain('X-CSRF-Token');
  });

  it('ignores preflight from a disallowed origin', () => {
    expect(handlePreflight(req('OPTIONS', 'https://evil.com'))).toBeNull();
  });

  it('does not treat non-OPTIONS as preflight', () => {
    expect(handlePreflight(req('POST', 'https://app.example.com'))).toBeNull();
  });
});
