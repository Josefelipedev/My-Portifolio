// @vitest-environment node
// jose verifies Uint8Array by identity; jsdom's cross-realm typed arrays break
// that, so this suite runs in the node environment.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

// Pin a known JWT secret BEFORE app import (dotenv in env.ts won't override it).
vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
});

const db = vi.hoisted(() => ({
  session: { findFirst: vi.fn() },
  // other models referenced by sibling routes at construction time:
  project: { findMany: vi.fn() },
  skill: { findMany: vi.fn() },
  experience: { findMany: vi.fn() },
  education: { findMany: vi.fn() },
  siteConfig: { findUnique: vi.fn() },
  contactMessage: { create: vi.fn() },
}));
vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/email', () => ({ sendContactNotification: vi.fn() }));

import app from '../../../apps/api/src/app';

async function signToken(payload: Record<string, unknown>) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

const req = (path: string, init: RequestInit & { cookie?: string } = {}) => {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set('cookie', init.cookie);
  return app.fetch(new Request(`http://local${path}`, { ...init, headers }));
};

const CSRF = 'a'.repeat(64); // 64 hex chars

beforeEach(() => {
  vi.clearAllMocks();
  db.session.findFirst.mockResolvedValue({ id: 's1', userId: 'u1', token: 'sess-1', isValid: true });
});

describe('requireAuth', () => {
  it('401s when no auth_token cookie is present', async () => {
    const res = await req('/api/admin/me');
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('200s with the userId for a valid token + live DB session', async () => {
    const token = await signToken({ userId: 'u1', sessionToken: 'sess-1' });
    const res = await req('/api/admin/me', { cookie: `auth_token=${token}` });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: 'u1' });
    expect(db.session.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'u1', token: 'sess-1', isValid: true }),
      }),
    );
  });

  it('401s for a valid JWT whose session is gone/invalid in the DB', async () => {
    db.session.findFirst.mockResolvedValue(null);
    const token = await signToken({ userId: 'u1', sessionToken: 'sess-1' });
    const res = await req('/api/admin/me', { cookie: `auth_token=${token}` });
    expect(res.status).toBe(401);
  });

  it('401s for a tampered/garbage token', async () => {
    const res = await req('/api/admin/me', { cookie: 'auth_token=not-a-jwt' });
    expect(res.status).toBe(401);
    expect(db.session.findFirst).not.toHaveBeenCalled();
  });
});

describe('requireCsrf (on top of auth)', () => {
  it('403s a mutation without a matching CSRF token', async () => {
    const token = await signToken({ userId: 'u1', sessionToken: 'sess-1' });
    const res = await req('/api/admin/ping', { method: 'POST', cookie: `auth_token=${token}` });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('200s a mutation with matching csrf cookie + header', async () => {
    const token = await signToken({ userId: 'u1', sessionToken: 'sess-1' });
    const res = await req('/api/admin/ping', {
      method: 'POST',
      cookie: `auth_token=${token}; csrf_token=${CSRF}`,
      headers: { 'x-csrf-token': CSRF },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, userId: 'u1' });
  });
});
