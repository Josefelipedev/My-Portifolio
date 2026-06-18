// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
});

const db = vi.hoisted(() => ({
  session: { findFirst: vi.fn() },
  knowledgeItem: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  knowledgeSource: { findMany: vi.fn(), create: vi.fn() },
}));
vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/email', () => ({ sendContactNotification: vi.fn() }));

const knowledgeLib = vi.hoisted(() => ({
  processKnowledgeSource: vi.fn(),
  // buildKnowledgeContext is imported by routes/ai.ts; KNOWLEDGE_TYPES by the
  // knowledge route — keep both real-ish so the app still constructs.
  buildKnowledgeContext: vi.fn(() => ''),
  KNOWLEDGE_TYPES: [
    'skill',
    'project',
    'experience',
    'achievement',
    'course',
    'certification',
    'language',
    'tool',
    'domain',
    'responsibility',
    'evidence',
  ] as const,
}));
vi.mock('../../../apps/api/src/lib/knowledge', () => knowledgeLib);

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

describe('knowledge guards', () => {
  it('401s listing without auth', async () => {
    const res = await app.fetch(new Request('http://local/api/admin/knowledge'));
    expect(res.status).toBe(401);
  });

  it('401s creating without auth', async () => {
    const res = await app.fetch(
      new Request('http://local/api/admin/knowledge', { method: 'POST', body: '{}' }),
    );
    expect(res.status).toBe(401);
  });
});

describe('knowledge items', () => {
  it('lists items with pagination + types', async () => {
    db.knowledgeItem.findMany.mockResolvedValue([{ id: 'k1', title: 'X' }]);
    db.knowledgeItem.count.mockResolvedValue(1);

    const res = await authed('/api/admin/knowledge?page=1&pageSize=10', 'GET');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.totalPages).toBe(1);
    expect(body.types).toContain('skill');
  });

  it('creates an item (201)', async () => {
    db.knowledgeItem.create.mockResolvedValue({ id: 'k1' });
    const res = await authed('/api/admin/knowledge', 'POST', {
      type: 'skill',
      title: 'Next.js',
      content: 'Built apps with Next.js',
    });
    expect(res.status).toBe(201);
    expect(db.knowledgeItem.create).toHaveBeenCalledOnce();
  });

  it('400s on missing required fields', async () => {
    const res = await authed('/api/admin/knowledge', 'POST', { title: 'X' });
    expect(res.status).toBe(400);
    expect(db.knowledgeItem.create).not.toHaveBeenCalled();
  });

  it('400s on invalid type', async () => {
    const res = await authed('/api/admin/knowledge', 'POST', {
      type: 'nope',
      title: 'X',
      content: 'Y',
    });
    expect(res.status).toBe(400);
  });

  it('404s updating a missing id', async () => {
    db.knowledgeItem.update.mockRejectedValue(new Error('not found'));
    const res = await authed('/api/admin/knowledge/missing', 'PUT', { title: 'Y' });
    expect(res.status).toBe(404);
  });

  it('deletes an item (204)', async () => {
    db.knowledgeItem.delete.mockResolvedValue({});
    const res = await authed('/api/admin/knowledge/k1', 'DELETE');
    expect(res.status).toBe(204);
  });
});

describe('knowledge sources', () => {
  it('lists sources (static path not swallowed by /:id)', async () => {
    db.knowledgeSource.findMany.mockResolvedValue([{ id: 'src1', title: 'CV' }]);
    const res = await authed('/api/admin/knowledge/sources', 'GET');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sources).toHaveLength(1);
  });

  it('400s creating a source under 100 chars', async () => {
    const res = await authed('/api/admin/knowledge/sources', 'POST', { rawText: 'short' });
    expect(res.status).toBe(400);
    expect(db.knowledgeSource.create).not.toHaveBeenCalled();
  });

  it('creates a source (201)', async () => {
    db.knowledgeSource.create.mockResolvedValue({ id: 'src1', title: null });
    const res = await authed('/api/admin/knowledge/sources', 'POST', {
      rawText: 'x'.repeat(150),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.source.id).toBe('src1');
    expect(body.result).toBeNull();
  });

  it('processes a source via the mocked AI engine', async () => {
    knowledgeLib.processKnowledgeSource.mockResolvedValue({
      sourceId: 'src1',
      created: 2,
      updated: 0,
      skipped: 0,
      protectedManual: 0,
      chunksProcessed: 1,
      items: [],
    });
    const res = await authed('/api/admin/knowledge/sources/src1/process', 'POST');
    expect(res.status).toBe(200);
    expect(knowledgeLib.processKnowledgeSource).toHaveBeenCalledWith('src1');
    const body = await res.json();
    expect(body.result.created).toBe(2);
  });
});
