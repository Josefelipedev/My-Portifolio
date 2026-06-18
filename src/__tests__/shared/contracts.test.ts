import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
  HttpClient,
  ApiClientError,
  PortfolioApi,
  projectSchema,
  skillSchema,
} from '@/shared/contracts';

function mockFetch(status: number, body: unknown): typeof fetch {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  })) as unknown as typeof fetch;
}

const sampleProject = {
  id: 'p1',
  title: 'Portfolio',
  description: 'My site',
  readme: null,
  technologies: 'Next.js,TypeScript',
  repoUrl: 'https://github.com/x/y',
  demoUrl: null,
  githubId: 123,
  source: 'github',
  aiSummary: null,
  aiSummarizedAt: null,
  imageUrl: null,
  stars: 5,
  featured: true,
  rank: 1,
  isPrivate: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('contract schemas', () => {
  it('parses a serialized Project', () => {
    expect(projectSchema.parse(sampleProject).title).toBe('Portfolio');
  });

  it('rejects an invalid skill level', () => {
    const bad = { id: 's', name: 'X', category: 'tools', level: 9, iconUrl: null, order: 0 };
    expect(skillSchema.safeParse(bad).success).toBe(false);
  });
});

describe('HttpClient', () => {
  it('returns schema-validated data on 200', async () => {
    const http = new HttpClient({ baseUrl: 'https://api.test', fetchImpl: mockFetch(200, [sampleProject]) });
    const api = new PortfolioApi(http);
    const projects = await api.listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].title).toBe('Portfolio');
  });

  it('throws a typed ApiClientError carrying status + code on error envelope', async () => {
    const http = new HttpClient({
      baseUrl: 'https://api.test',
      fetchImpl: mockFetch(404, { error: 'Not found', code: 'NOT_FOUND' }),
    });
    await expect(http.get('/api/projects', z.array(projectSchema))).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('throws SCHEMA_MISMATCH when the body does not match', async () => {
    const http = new HttpClient({
      baseUrl: 'https://api.test',
      fetchImpl: mockFetch(200, [{ id: 'p1' /* missing required fields */ }]),
    });
    await expect(http.get('/api/projects', z.array(projectSchema))).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'SCHEMA_MISMATCH',
    });
  });

  it('attaches a CSRF token to mutating requests', async () => {
    const spy = vi.fn(async () => ({ ok: true, status: 200, text: async () => '{}' })) as unknown as typeof fetch;
    const http = new HttpClient({
      baseUrl: 'https://api.test',
      fetchImpl: spy,
      getCsrfToken: () => 'tok-123',
    });
    await http.post('/api/anything', z.object({}), { a: 1 });
    const [, init] = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((init.headers as Record<string, string>)['x-csrf-token']).toBe('tok-123');
  });
});
