// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SignJWT } from 'jose';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
});

const db = vi.hoisted(() => ({ session: { findFirst: vi.fn() } }));
const email = vi.hoisted(() => ({ sendContactNotification: vi.fn(), sendScraperAlert: vi.fn() }));
vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/email', () => email);
vi.mock('../../../apps/api/src/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import app from '../../../apps/api/src/app';

const CSRF = 'a'.repeat(64);

async function request(method: string, query: string, withCsrf = true) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const jwt = await new SignJWT({ userId: 'u1', sessionToken: 's1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
  return app.fetch(
    new Request(`http://local/api/admin/scraper-logs${query}`, {
      method,
      headers: withCsrf
        ? { cookie: `auth_token=${jwt}; csrf_token=${CSRF}`, 'x-csrf-token': CSRF }
        : { cookie: `auth_token=${jwt}` },
    }),
  );
}

describe('admin scraper proxy', () => {
  const fetchMock = vi.fn();
  const deleteCalls = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    db.session.findFirst.mockResolvedValue({ id: 's', userId: 'u1', token: 's1', isValid: true });
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ status: 'ok', cleared: 3 }), { status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['clear-logs', 'clear-debug', 'test'])('refuses the "%s" action over GET', async (action) => {
    const res = await request('GET', `?action=${action}&alert=true`);

    expect(res.status).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(email.sendScraperAlert).not.toHaveBeenCalled();
  });

  it('needs the CSRF token to clear logs', async () => {
    const res = await request('POST', '?action=clear-logs', false);

    expect(res.status).toBe(403);
    expect(deleteCalls()).toEqual([]);
  });

  it('clears the scraper logs over POST', async () => {
    const res = await request('POST', '?action=clear-logs');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, cleared: 3 });
    expect(deleteCalls().map(([url]) => url)).toEqual([expect.stringMatching(/\/logs$/)]);
  });

  it('rejects an unknown POST action', async () => {
    expect((await request('POST', '?action=status')).status).toBe(400);
  });

  it('still serves the read-only status over GET', async () => {
    const res = await request('GET', '');

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ available: true });
  });
});
