// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
});

const db = vi.hoisted(() => ({
  session: { findFirst: vi.fn() },
  book: { update: vi.fn(), delete: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
  education: { create: vi.fn(), findFirst: vi.fn() },
  project: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
  skill: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
  experience: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
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

describe('content-import guards', () => {
  it('401s without auth', async () => {
    const res = await app.fetch(
      new Request('http://local/api/books/import', { method: 'POST', body: '[]' }),
    );
    expect(res.status).toBe(401);
  });
});

describe('content-import mutations', () => {
  it('updates a book (200)', async () => {
    db.book.update.mockResolvedValue({ id: 'b1', title: 'New', status: 'reading' });
    const res = await authed('/api/books/b1', 'PUT', { title: 'New', status: 'reading', progress: 50 });
    expect(res.status).toBe(200);
    expect(db.book.update).toHaveBeenCalledOnce();
  });

  it('rejects an invalid status (400)', async () => {
    const res = await authed('/api/books/b1', 'PUT', { status: 'nope' });
    expect(res.status).toBe(400);
    expect(db.book.update).not.toHaveBeenCalled();
  });

  it('404s when deleting a missing book', async () => {
    db.book.delete.mockRejectedValue(new Error('not found'));
    const res = await authed('/api/books/missing', 'DELETE');
    expect(res.status).toBe(404);
  });

  it('imports books, skipping duplicates and incomplete rows', async () => {
    db.book.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'dup' });
    db.book.create.mockResolvedValue({ id: 'new' });
    const res = await authed('/api/books/import', 'POST', [
      { title: 'A', author: 'Author A', percentage: 0.5 },
      { title: 'B', author: 'Author B' }, // duplicate
      { title: 'C' }, // missing author -> skipped
    ]);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { imported: number; skipped: number; total: number };
    expect(json).toEqual({ imported: 1, skipped: 2, total: 3 });
    expect(db.book.create).toHaveBeenCalledOnce();
    expect(db.book.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ progress: 50, status: 'reading' }) }),
    );
  });

  it('400s on an empty import payload', async () => {
    const res = await authed('/api/books/import', 'POST', []);
    expect(res.status).toBe(400);
  });
});
