// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
});

const db = vi.hoisted(() => ({
  session: { findFirst: vi.fn() },
  experience: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  skill: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  education: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/email', () => ({ sendContactNotification: vi.fn() }));

// Avoid touching the real filesystem on sync's resume.json write.
const fsMock = vi.hoisted(() => ({ mkdir: vi.fn(), writeFile: vi.fn() }));
vi.mock('node:fs', () => ({ promises: fsMock }));

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

const ANALYSIS = {
  personalInfo: { name: 'Jane', email: 'jane@example.com' },
  professionalSummary: { pt: 'resumo', en: 'summary' },
  experience: [
    { title: 'Dev', company: 'Acme', location: 'Remote', startDate: '2022-01', endDate: '2023-01', responsibilities: ['Built things'] },
  ],
  education: [{ degree: 'BSc CS', institution: 'Uni', startDate: '2016-01', endDate: '2020-01' }],
  skills: [{ name: 'TypeScript', level: 5, category: 'frontend' as const }],
  certifications: [],
  languages: [{ language: 'English', level: 'C1' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  db.session.findFirst.mockResolvedValue({ id: 's', userId: 'u1', token: 's1', isValid: true });
});

describe('resume-admin guards', () => {
  it('401s without auth', async () => {
    const res = await app.fetch(new Request('http://local/api/resume/compare', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(401);
  });

  it('403s with auth but no CSRF', async () => {
    const jwt = await token();
    const res = await app.fetch(
      new Request('http://local/api/resume/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: `auth_token=${jwt}` },
        body: JSON.stringify({ analysis: ANALYSIS }),
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe('resume-admin compare', () => {
  it('400s without analysis', async () => {
    const res = await authed('/api/resume/compare', 'POST', {});
    expect(res.status).toBe(400);
  });

  it('diffs the analysis against DB content', async () => {
    db.experience.findMany.mockResolvedValue([]); // no existing -> add
    db.skill.findMany.mockResolvedValue([
      { id: 'sk1', name: 'TypeScript', category: 'backend', level: 3 }, // exists, differs -> update
    ]);

    const res = await authed('/api/resume/compare', 'POST', { analysis: ANALYSIS });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.comparison.summary.experiences.add).toBe(1);
    expect(json.comparison.summary.skills.update).toBe(1);
    expect(db.experience.findMany).toHaveBeenCalledOnce();
    expect(db.skill.findMany).toHaveBeenCalledOnce();
  });
});

describe('resume-admin sync', () => {
  it('upserts experiences/skills/education and writes resume.json', async () => {
    db.experience.findFirst.mockResolvedValue(null);
    db.experience.create.mockResolvedValue({ id: 'e1' });
    db.skill.findFirst.mockResolvedValue(null);
    db.skill.create.mockResolvedValue({ id: 'sk1' });
    db.education.findFirst.mockResolvedValue(null);
    db.education.create.mockResolvedValue({ id: 'ed1' });

    const res = await authed('/api/resume/sync', 'POST', { analysis: ANALYSIS });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.results.experiences.created).toBe(1);
    expect(json.results.skills.created).toBe(1);
    expect(json.results.education.created).toBe(1);
    expect(json.results.jsonUpdated).toBe(true);
    expect(db.experience.create).toHaveBeenCalledOnce();
    expect(db.skill.create).toHaveBeenCalledOnce();
    expect(db.education.create).toHaveBeenCalledOnce();
    expect(fsMock.writeFile).toHaveBeenCalledOnce();
  });
});
