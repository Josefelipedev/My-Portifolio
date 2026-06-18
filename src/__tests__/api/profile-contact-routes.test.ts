import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  siteConfig: { findUnique: vi.fn() },
  contactMessage: { create: vi.fn() },
  project: { findMany: vi.fn() },
  skill: { findMany: vi.fn() },
  experience: { findMany: vi.fn() },
  education: { findMany: vi.fn() },
}));
const email = vi.hoisted(() => ({ sendContactNotification: vi.fn(async () => true) }));

vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/email', () => email);

import app from '../../../apps/api/src/app';
import { siteConfigResponseSchema } from '@portfolio/shared';

const post = (path: string, body: unknown, ip = '1.2.3.4') =>
  app.fetch(
    new Request(`http://local${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    }),
  );

const validMsg = { name: 'Jane', email: 'jane@example.com', message: 'Hello there, this is long enough.' };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.TURNSTILE_SECRET_KEY;
  db.contactMessage.create.mockResolvedValue({ id: 'cm1' });
});

describe('GET /api/profile', () => {
  it('returns public fields in the envelope, contract-valid', async () => {
    db.siteConfig.findUnique.mockResolvedValue({
      id: 'main', name: 'Jose', title: 'Dev', bio: null, avatarUrl: null,
      githubUrl: null, linkedinUrl: null, twitterUrl: null, email: null, location: null,
    });
    const res = await app.fetch(new Request('http://local/api/profile'));
    expect(res.status).toBe(200);
    const body = siteConfigResponseSchema.parse(await res.json());
    expect(body.data?.name).toBe('Jose');
    // select must be the public-only projection (no secrets)
    expect(db.siteConfig.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'main' } }),
    );
    const arg = db.siteConfig.findUnique.mock.calls[0][0];
    expect(arg.select.jobApiKeys).toBeUndefined();
    expect(arg.select.wakatimeConfig).toBeUndefined();
  });
});

describe('POST /api/contact', () => {
  it('creates the message and fires the notification on valid input', async () => {
    const res = await post('/api/contact', validMsg, 'ip-valid');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, id: 'cm1' });
    expect(db.contactMessage.create).toHaveBeenCalledOnce();
    expect(email.sendContactNotification).toHaveBeenCalledOnce();
  });

  it('silently succeeds on honeypot without creating', async () => {
    const res = await post('/api/contact', { ...validMsg, honeypot: 'bot' }, 'ip-hp');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(db.contactMessage.create).not.toHaveBeenCalled();
  });

  it('rejects short name / bad email / short message with 400', async () => {
    expect((await post('/api/contact', { ...validMsg, name: 'J' }, 'ip-a')).status).toBe(400);
    expect((await post('/api/contact', { ...validMsg, email: 'nope' }, 'ip-b')).status).toBe(400);
    expect((await post('/api/contact', { ...validMsg, message: 'short' }, 'ip-c')).status).toBe(400);
    expect(db.contactMessage.create).not.toHaveBeenCalled();
  });

  it('rate-limits after 5 attempts from the same IP (429)', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await post('/api/contact', validMsg, 'ip-rl')).status).toBe(200);
    }
    expect((await post('/api/contact', validMsg, 'ip-rl')).status).toBe(429);
  });
});
