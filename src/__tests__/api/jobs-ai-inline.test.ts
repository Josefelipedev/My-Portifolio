// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
  process.env.TOGETHER_API_KEY = 'test-key';
});

const db = vi.hoisted(() => ({
  session: { findFirst: vi.fn() },
  savedJob: { findUnique: vi.fn(), update: vi.fn() },
}));

const aiTracking = vi.hoisted(() => ({
  trackAIUsage: vi.fn().mockResolvedValue(undefined),
  estimateTokens: vi.fn(() => 10),
  checkQuotaLimits: vi.fn(),
}));

// Together SDK mock: new Together() -> { chat.completions.create }
const create = vi.hoisted(() => vi.fn());
const TogetherMock = vi.hoisted(() =>
  vi.fn(() => ({ chat: { completions: { create } } })),
);

vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/ai-tracking', () => aiTracking);
vi.mock('../../../apps/api/src/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('together-ai', () => ({ default: TogetherMock }));

import app from '../../../apps/api/src/app';

const CSRF = 'a'.repeat(64);

async function signedJwt() {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return new SignJWT({ userId: 'u1', sessionToken: 's1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

async function authed(path: string, body?: unknown) {
  const jwt = await signedJwt();
  return app.fetch(
    new Request(`http://local${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `auth_token=${jwt}; csrf_token=${CSRF}`,
        'x-csrf-token': CSRF,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  );
}

// Authenticated request WITHOUT a matching CSRF token (cookie/header mismatch).
async function authedNoCsrf(path: string, body?: unknown) {
  const jwt = await signedJwt();
  return app.fetch(
    new Request(`http://local${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `auth_token=${jwt}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  );
}

function aiReturns(content: string) {
  create.mockResolvedValue({
    usage: { prompt_tokens: 5, completion_tokens: 7 },
    choices: [{ message: { content } }],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.session.findFirst.mockResolvedValue({ id: 's', userId: 'u1', token: 's1', isValid: true });
  aiTracking.checkQuotaLimits.mockResolvedValue({ withinLimits: true });
  TogetherMock.mockReturnValue({ chat: { completions: { create } } });
});

describe('jobs inline-AI — auth & csrf', () => {
  it('401s without auth on every endpoint', async () => {
    for (const path of [
      '/api/jobs/saved/j1/enrich',
      '/api/jobs/saved/j1/interview-prep',
      '/api/jobs/generate-email',
      '/api/jobs/extract',
    ]) {
      const res = await app.fetch(new Request(`http://local${path}`, { method: 'POST' }));
      expect(res.status).toBe(401);
    }
  });

  it('403s when CSRF token is missing/mismatched', async () => {
    const res = await authedNoCsrf('/api/jobs/extract', { text: 'x'.repeat(50) });
    expect(res.status).toBe(403);
  });
});

describe('jobs inline-AI — extract', () => {
  it('400s when text is too short', async () => {
    expect((await authed('/api/jobs/extract', { text: 'short' })).status).toBe(400);
    expect((await authed('/api/jobs/extract', {})).status).toBe(400);
  });

  it('429s when quota is exceeded', async () => {
    aiTracking.checkQuotaLimits.mockResolvedValueOnce({ withinLimits: false });
    const res = await authed('/api/jobs/extract', { text: 'A real job posting text here.' });
    expect(res.status).toBe(429);
  });

  it('extracts and returns the parsed job fields', async () => {
    aiReturns('{"title":"Dev","company":"Acme","location":"Remote"}');
    const res = await authed('/api/jobs/extract', { text: 'Hiring a developer at Acme, remote.' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ title: 'Dev', company: 'Acme', location: 'Remote' });
    expect(aiTracking.trackAIUsage).toHaveBeenCalled();
  });
});

describe('jobs inline-AI — generate-email', () => {
  it('400s when jobTitle/company missing', async () => {
    expect((await authed('/api/jobs/generate-email', { jobTitle: 'Dev' })).status).toBe(400);
    expect((await authed('/api/jobs/generate-email', { company: 'Acme' })).status).toBe(400);
  });

  it('returns subject + body on success', async () => {
    aiReturns('{"subject":"Candidatura: Dev","body":"Boa tarde, ..."}');
    const res = await authed('/api/jobs/generate-email', { jobTitle: 'Dev', company: 'Acme' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ subject: 'Candidatura: Dev', body: 'Boa tarde, ...' });
  });
});

describe('jobs inline-AI — interview-prep', () => {
  it('404s when the saved job does not exist', async () => {
    db.savedJob.findUnique.mockResolvedValue(null);
    const res = await authed('/api/jobs/saved/missing/interview-prep');
    expect(res.status).toBe(404);
  });

  it('503s when Together is not configured', async () => {
    db.savedJob.findUnique.mockResolvedValue({ id: 'j1', title: 'Dev', company: 'Acme' });
    const orig = process.env.TOGETHER_API_KEY;
    delete process.env.TOGETHER_API_KEY;
    const res = await authed('/api/jobs/saved/j1/interview-prep');
    process.env.TOGETHER_API_KEY = orig;
    expect(res.status).toBe(503);
  });

  it('generates prep and persists it', async () => {
    db.savedJob.findUnique.mockResolvedValue({
      id: 'j1',
      title: 'Dev',
      company: 'Acme',
      location: 'Remote',
      salary: null,
      description: 'Build things',
    });
    db.savedJob.update.mockResolvedValue({ id: 'j1' });
    aiReturns('{"starStories":[],"technicalTopics":[],"keyQuestions":[]}');
    const res = await authed('/api/jobs/saved/j1/interview-prep');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, prep: { starStories: [] } });
    expect(db.savedJob.update).toHaveBeenCalled();
  });
});

describe('jobs inline-AI — enrich', () => {
  it('404s when the saved job does not exist', async () => {
    db.savedJob.findUnique.mockResolvedValue(null);
    const res = await authed('/api/jobs/saved/missing/enrich');
    expect(res.status).toBe(404);
  });

  it('enriches the job from its fetched page', async () => {
    db.savedJob.findUnique.mockResolvedValue({
      id: 'j1',
      title: 'Dev',
      company: 'Acme',
      url: 'https://example.com/job',
    });
    db.savedJob.update.mockResolvedValue({ id: 'j1', contactEmail: 'hr@acme.com' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>apply hr@acme.com</html>', { status: 200 }),
    );
    aiReturns(
      '{"emails":["hr@acme.com"],"phones":[],"requirements":[],"benefits":[],"applicationProcess":"","companyInfo":""}',
    );
    const res = await authed('/api/jobs/saved/j1/enrich');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      extracted: { email: 'hr@acme.com', emailsFound: 1 },
    });
    expect(db.savedJob.update).toHaveBeenCalled();
  });
});
