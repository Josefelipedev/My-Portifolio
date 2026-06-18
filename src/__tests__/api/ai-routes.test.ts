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
  knowledgeItem: { findMany: vi.fn() },
  education: { findMany: vi.fn() },
  siteConfig: { findUnique: vi.fn() },
  contactMessage: { create: vi.fn() },
}));
const claude = vi.hoisted(() => ({
  generateSkillsSuggestion: vi.fn(),
  analyzeReadmeForProject: vi.fn(),
  analyzeResumePDF: vi.fn(),
  getCurrentAIProvider: vi.fn(() => ({ provider: 'together', model: 'm' })),
}));
vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/claude', () => claude);
vi.mock('../../../apps/api/src/lib/email', () => ({ sendContactNotification: vi.fn() }));

import app from '../../../apps/api/src/app';

const CSRF = 'a'.repeat(64);
async function authed(path: string, body?: unknown) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const jwt = await new SignJWT({ userId: 'u1', sessionToken: 's1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
  return app.fetch(
    new Request(`http://local${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `auth_token=${jwt}; csrf_token=${CSRF}`, 'x-csrf-token': CSRF },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  db.session.findFirst.mockResolvedValue({ id: 's', userId: 'u1', token: 's1', isValid: true });
  db.project.findMany.mockResolvedValue([]);
  db.experience.findMany.mockResolvedValue([]);
  db.skill.findMany.mockResolvedValue([]);
  db.knowledgeItem.findMany.mockResolvedValue([]);
});

describe('POST /api/skills/suggest', () => {
  it('401s without auth', async () => {
    const res = await app.fetch(new Request('http://local/api/skills/suggest', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(401);
  });

  it('400s when there is no data to analyze', async () => {
    const res = await authed('/api/skills/suggest', {});
    expect(res.status).toBe(400);
    expect(claude.generateSkillsSuggestion).not.toHaveBeenCalled();
  });

  it('feeds the knowledge base into the suggestion call and returns filtered results', async () => {
    db.knowledgeItem.findMany.mockResolvedValue([
      { type: 'tool', title: 'Kafka', content: 'event streaming', tags: 'Kafka', confidence: 5, priority: 7 },
    ]);
    db.skill.findMany.mockResolvedValue([{ name: 'React' }]);
    claude.generateSkillsSuggestion.mockResolvedValue([
      { name: 'Kafka', category: 'backend', level: 5, reason: 'x' },
      { name: 'React', category: 'frontend', level: 4, reason: 'y' }, // existing -> filtered out
    ]);

    const res = await authed('/api/skills/suggest', {});
    expect(res.status).toBe(200);
    const json = (await res.json()) as { suggestions: { name: string }[]; analyzed: { knowledge: number } };
    expect(json.suggestions.map((s) => s.name)).toEqual(['Kafka']);
    expect(json.analyzed.knowledge).toBe(1);
    const arg = claude.generateSkillsSuggestion.mock.calls[0][0];
    expect(arg.knowledgeContext).toContain('Kafka');
  });
});

describe('POST /api/projects/analyze', () => {
  it('400s on a too-short README', async () => {
    expect((await authed('/api/projects/analyze', { readme: 'short' })).status).toBe(400);
  });

  it('returns analysis for a valid README', async () => {
    claude.analyzeReadmeForProject.mockResolvedValue({
      suggestedTitle: 'T', suggestedDescription: 'D', detectedTechnologies: ['TS'], aiSummary: 'S',
    });
    const res = await authed('/api/projects/analyze', { readme: 'x'.repeat(60), title: 'Repo', repoUrl: 'u' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ suggestedTitle: 'T', detectedTechnologies: ['TS'], repoUrl: 'u' });
  });
});
