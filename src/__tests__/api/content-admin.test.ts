// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
});

const db = vi.hoisted(() => ({
  session: { findFirst: vi.fn() },
  project: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
  skill: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
  experience: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
  education: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
  siteConfig: { findUnique: vi.fn() },
  contactMessage: { create: vi.fn() },
}));
vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/email', () => ({ sendContactNotification: vi.fn() }));

import app from '../../../apps/api/src/app';

const CSRF = 'a'.repeat(64);

async function token() {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return new SignJWT({ userId: 'u1', sessionToken: 's1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

async function authed(path: string, method: string, body?: unknown) {
  const jwt = await token();
  return app.fetch(
    new Request(`http://local${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        cookie: `auth_token=${jwt}; csrf_token=${CSRF}`,
        'x-csrf-token': CSRF,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  db.session.findFirst.mockResolvedValue({ id: 's', userId: 'u1', token: 's1', isValid: true });
});

describe('content-admin guards', () => {
  it('401s without auth', async () => {
    const res = await app.fetch(new Request('http://local/api/projects', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(401);
  });

  it('403s with auth but no CSRF', async () => {
    const jwt = await token();
    const res = await app.fetch(
      new Request('http://local/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: `auth_token=${jwt}` },
        body: JSON.stringify({ name: 'X', category: 'tools' }),
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe('content-admin mutations', () => {
  it('creates a skill (201) and validates category', async () => {
    db.skill.create.mockResolvedValue({ id: 'sk1', name: 'X', category: 'tools', level: 3, iconUrl: null, order: 0 });
    const ok = await authed('/api/skills', 'POST', { name: 'X', category: 'tools' });
    expect(ok.status).toBe(201);
    expect(db.skill.create).toHaveBeenCalledOnce();

    const bad = await authed('/api/skills', 'POST', { name: 'X', category: 'nope' });
    expect(bad.status).toBe(400);
  });

  it('reorders rank + sets featured on project create', async () => {
    db.project.create.mockResolvedValue({ id: 'p1' });
    const res = await authed('/api/projects', 'POST', { title: 'T', rank: 1 });
    expect(res.status).toBe(201);
    expect(db.project.updateMany).toHaveBeenCalledWith({ where: { rank: 1 }, data: { rank: null } });
    expect(db.project.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rank: 1, featured: true }) }),
    );
  });

  it('updates an experience (200) and deletes education (204)', async () => {
    db.experience.update.mockResolvedValue({ id: 'e1' });
    expect((await authed('/api/experiences/e1', 'PUT', { title: 'New' })).status).toBe(200);

    db.education.delete.mockResolvedValue({});
    expect((await authed('/api/education/ed1', 'DELETE')).status).toBe(204);
  });

  it('404s when updating a missing id', async () => {
    db.skill.update.mockRejectedValue(new Error('not found'));
    const res = await authed('/api/skills/missing', 'PUT', { name: 'Y' });
    expect(res.status).toBe(404);
  });
});
