// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  session: { findFirst: vi.fn() },
  project: { findMany: vi.fn() }, experience: { findMany: vi.fn() }, skill: { findMany: vi.fn() },
  education: { findMany: vi.fn() }, siteConfig: { findUnique: vi.fn() }, contactMessage: { create: vi.fn() },
}));
const authService = vi.hoisted(() => ({
  initiateLogin: vi.fn(), verifyCodeAndCreateSession: vi.fn(), logout: vi.fn(), validateSession: vi.fn(),
}));
vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/auth-service', () => authService);
vi.mock('../../../apps/api/src/lib/email', () => ({ sendContactNotification: vi.fn() }));
vi.mock('../../../apps/api/src/lib/claude', () => ({
  generateSkillsSuggestion: vi.fn(), analyzeReadmeForProject: vi.fn(), analyzeResumePDF: vi.fn(),
  getCurrentAIProvider: vi.fn(() => ({ provider: 'together', model: 'm' })),
}));
vi.mock('../../../apps/api/src/lib/jobs/cv-generator', () => ({ generateCustomCV: vi.fn() }));
vi.mock('../../../apps/api/src/lib/jobs/ai-analysis', () => ({ analyzeJob: vi.fn() }));

import app from '../../../apps/api/src/app';

const json = (path: string, body?: unknown) =>
  app.fetch(new Request(`http://local${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }));

beforeEach(() => vi.clearAllMocks());

describe('auth routes', () => {
  it('GET /api/csrf issues a 64-char token and sets the cookie', async () => {
    const res = await app.fetch(new Request('http://local/api/csrf'));
    expect(res.status).toBe(200);
    expect((await res.json() as { csrfToken: string }).csrfToken).toHaveLength(64);
    expect(res.headers.get('set-cookie')).toContain('csrf_token=');
  });

  it('login 400s on missing credentials', async () => {
    expect((await json('/api/auth/login', { email: 'a@b.c' })).status).toBe(400);
    expect((await json('/api/auth/login', {})).status).toBe(400);
  });

  it('login dev-mode sets the auth cookie on success', async () => {
    authService.initiateLogin.mockResolvedValue({ success: true, token: 'jwt-x', requiresVerification: false, userId: 'u1' });
    const res = await json('/api/auth/login', { email: 'a@b.c', password: 'secret' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, requiresVerification: false });
    expect(res.headers.get('set-cookie')).toContain('auth_token=jwt-x');
  });

  it('login 401s on bad credentials', async () => {
    authService.initiateLogin.mockResolvedValue({ success: false, error: 'invalid' });
    expect((await json('/api/auth/login', { email: 'a@b.c', password: 'x' })).status).toBe(401);
  });

  it('verify 400s on a non-6-digit code, logout clears the cookie', async () => {
    expect((await json('/api/auth/verify', { userId: 'u1', code: '12' })).status).toBe(400);
    const out = await json('/api/logout');
    expect(out.status).toBe(200);
    expect(out.headers.get('set-cookie')).toContain('auth_token=;');
  });
});
