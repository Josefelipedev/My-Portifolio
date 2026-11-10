// @vitest-environment node
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SignJWT } from 'jose';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
});

const db = vi.hoisted(() => ({ session: { findFirst: vi.fn() } }));
vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/email', () => ({ sendContactNotification: vi.fn() }));

import app from '../../../apps/api/src/app';

const PERSONAL_INFO = {
  name: 'Jose',
  email: 'jose@example.com',
  phone: '+351 900 000 000',
  address: 'Rua Exemplo 1, Faro',
  birthDate: '1990-01-01',
  linkedin: 'jose',
  github: 'jose',
};

async function sessionCookie() {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const jwt = await new SignJWT({ userId: 'u1', sessionToken: 's1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
  return `auth_token=${jwt}`;
}

const getResume = (query: string, cookie?: string) =>
  app.fetch(new Request(`http://local/api/resume${query}`, { headers: cookie ? { cookie } : {} }));

beforeAll(() => {
  const dir = mkdtempSync(path.join(tmpdir(), 'resume-'));
  const file = path.join(dir, 'resume.json');
  writeFileSync(file, JSON.stringify({ personalInfo: PERSONAL_INFO, professionalSummary: { en: 'Dev' } }));
  process.env.RESUME_JSON_PATH = file;
  process.env.RESUME_PDF_PATH = path.join(dir, 'missing.pdf');
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/resume personal info', () => {
  it('leaves the phone, address and birth date out for visitors', async () => {
    for (const query of ['?section=personal', '?section=all']) {
      const body = await (await getResume(query)).json();

      expect(body.personalInfo).toEqual({ name: 'Jose', email: 'jose@example.com', linkedin: 'jose', github: 'jose' });
    }
  });

  it('treats an expired session like a visitor', async () => {
    db.session.findFirst.mockResolvedValue(null);

    const body = await (await getResume('?section=personal', await sessionCookie())).json();

    expect(body.personalInfo.phone).toBeUndefined();
  });

  it('returns everything to the signed-in owner', async () => {
    db.session.findFirst.mockResolvedValue({ id: 's', userId: 'u1', token: 's1', isValid: true });

    const body = await (await getResume('?section=personal', await sessionCookie())).json();

    expect(body.personalInfo).toEqual(PERSONAL_INFO);
  });
});
