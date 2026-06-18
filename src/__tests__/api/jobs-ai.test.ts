// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
});

const db = vi.hoisted(() => ({
  session: { findFirst: vi.fn() },
  project: { findMany: vi.fn() },
  experience: { findMany: vi.fn() },
  skill: { findMany: vi.fn() },
  education: { findMany: vi.fn() },
  siteConfig: { findUnique: vi.fn() },
  contactMessage: { create: vi.fn() },
}));
const cvGen = vi.hoisted(() => ({ generateCustomCV: vi.fn() }));
const aiAnalysis = vi.hoisted(() => ({ analyzeJob: vi.fn() }));

vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/email', () => ({ sendContactNotification: vi.fn() }));
vi.mock('../../../apps/api/src/lib/claude', () => ({
  generateSkillsSuggestion: vi.fn(), analyzeReadmeForProject: vi.fn(), analyzeResumePDF: vi.fn(),
  getCurrentAIProvider: vi.fn(() => ({ provider: 'together', model: 'm' })),
}));
vi.mock('../../../apps/api/src/lib/jobs/cv-generator', () => cvGen);
vi.mock('../../../apps/api/src/lib/jobs/ai-analysis', () => aiAnalysis);

import app from '../../../apps/api/src/app';

const CSRF = 'a'.repeat(64);
async function authed(path: string, body?: unknown) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const jwt = await new SignJWT({ userId: 'u1', sessionToken: 's1' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
  return app.fetch(new Request(`http://local${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: `auth_token=${jwt}; csrf_token=${CSRF}`, 'x-csrf-token': CSRF },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  db.session.findFirst.mockResolvedValue({ id: 's', userId: 'u1', token: 's1', isValid: true });
});

describe('jobs AI — generate-cv', () => {
  it('401s without auth', async () => {
    const res = await app.fetch(new Request('http://local/api/jobs/saved/j1/generate-cv', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns the tailored CV on success', async () => {
    cvGen.generateCustomCV.mockResolvedValue({ summary: 's', skills: [], experience: [] });
    const res = await authed('/api/jobs/saved/j1/generate-cv');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, customCV: { summary: 's' } });
    expect(cvGen.generateCustomCV).toHaveBeenCalledWith('j1');
  });

  it('maps error messages to status (quota->429, not found->404, not configured->503)', async () => {
    cvGen.generateCustomCV.mockRejectedValueOnce(new Error('AI quota exceeded'));
    expect((await authed('/api/jobs/saved/j1/generate-cv')).status).toBe(429);
    cvGen.generateCustomCV.mockRejectedValueOnce(new Error('Job not found'));
    expect((await authed('/api/jobs/saved/j1/generate-cv')).status).toBe(404);
    cvGen.generateCustomCV.mockRejectedValueOnce(new Error('AI service not configured'));
    expect((await authed('/api/jobs/saved/j1/generate-cv')).status).toBe(503);
  });

  it('batch validates jobIds and reports per-job results', async () => {
    expect((await authed('/api/jobs/batch/generate-cv', { jobIds: [] })).status).toBe(400);
    expect((await authed('/api/jobs/batch/generate-cv', { jobIds: Array(11).fill('x') })).status).toBe(400);

    cvGen.generateCustomCV.mockResolvedValueOnce({ summary: 'ok' }).mockRejectedValueOnce(new Error('boom'));
    const res = await authed('/api/jobs/batch/generate-cv', { jobIds: ['a', 'b'] });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { succeeded: number; failed: number; cvData: unknown[] };
    expect(json).toMatchObject({ succeeded: 1, failed: 1 });
    expect(json.cvData).toHaveLength(2);
  });
});

describe('jobs AI — analyze', () => {
  it('400s without jobId, 200s with analysis', async () => {
    expect((await authed('/api/jobs/analyze', {})).status).toBe(400);
    aiAnalysis.analyzeJob.mockResolvedValue({ grade: 'A' });
    const res = await authed('/api/jobs/analyze', { jobId: 'j1' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, analysis: { grade: 'A' } });
  });

  it('batch caps at 20', async () => {
    expect((await authed('/api/jobs/batch/analyze', { jobIds: Array(21).fill('x') })).status).toBe(400);
    aiAnalysis.analyzeJob.mockResolvedValue({ grade: 'B' });
    const res = await authed('/api/jobs/batch/analyze', { jobIds: ['a'] });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ succeeded: 1, failed: 0 });
  });
});
