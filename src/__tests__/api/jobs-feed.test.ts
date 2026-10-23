// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
});

const db = vi.hoisted(() => ({
  session: { findFirst: vi.fn() },
  jobPosting: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  jobIngestRun: { findFirst: vi.fn() },
  savedJob: { findUnique: vi.fn(), create: vi.fn() },
}));
const feed = vi.hoisted(() => ({ isIngestRunning: vi.fn(), runIngest: vi.fn() }));

vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/jobs/feed', () => feed);

import app from '../../../apps/api/src/app';

const CSRF = 'a'.repeat(64);

async function request(method: string, path: string, body?: unknown) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const jwt = await new SignJWT({ userId: 'u1', sessionToken: 's1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
  return app.fetch(new Request(`http://local${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      cookie: `auth_token=${jwt}; csrf_token=${CSRF}`,
      'x-csrf-token': CSRF,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
}

const posting = {
  id: 'p1', externalId: 'remotive-1', source: 'remotive', title: 'Backend Engineer', company: 'Acme',
  companyLogo: null, description: 'Node.js', url: 'https://acme.test/1', location: 'Remote', jobType: null,
  salary: null, tags: ['node'], postedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.session.findFirst.mockResolvedValue({ id: 's', userId: 'u1', token: 's1', isValid: true });
  feed.isIngestRunning.mockResolvedValue(false);
  feed.runIngest.mockResolvedValue({});
});

describe('job feed routes', () => {
  it('requires authentication', async () => {
    const response = await app.fetch(new Request('http://local/api/jobs/feed'));
    expect(response.status).toBe(401);
  });

  it('lists open postings with the requested filters and the last run', async () => {
    db.jobPosting.findMany.mockResolvedValue([posting]);
    db.jobPosting.count.mockResolvedValue(1);
    db.jobIngestRun.findFirst.mockResolvedValue({ id: 'r1', errors: '["Jobicy: 400"]' });

    const response = await request('GET', '/api/jobs/feed?days=3&minScore=60&status=new');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ total: 1, hasMore: false, running: false, lastRun: { errors: ['Jobicy: 400'] } });
    const args = db.jobPosting.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ closedAt: null, status: 'new', dealBreaker: null, matchScore: { gte: 60 } });
    expect(args.select.embedding).toBeUndefined();
  });

  it('rejects an unknown status filter', async () => {
    const response = await request('GET', '/api/jobs/feed?status=bogus');
    expect(response.status).toBe(400);
  });

  it('updates a posting status and 404s for unknown ids', async () => {
    db.jobPosting.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'p1' });
    db.jobPosting.update.mockResolvedValue({ ...posting, status: 'dismissed' });

    expect((await request('POST', '/api/jobs/feed/nope/status', { status: 'dismissed' })).status).toBe(404);
    const response = await request('POST', '/api/jobs/feed/p1/status', { status: 'dismissed' });
    expect(response.status).toBe(200);
    expect(db.jobPosting.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'dismissed' } }));
  });

  it('saves a posting into Saved Jobs, reusing an existing saved row', async () => {
    db.jobPosting.findUnique.mockResolvedValue(posting);
    db.savedJob.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'sj-existing' });
    db.savedJob.create.mockResolvedValue({ id: 'sj-new' });

    const first = await request('POST', '/api/jobs/feed/p1/save');
    expect(first.status).toBe(201);
    expect(db.savedJob.create).toHaveBeenCalledWith({ data: expect.objectContaining({ externalId: 'remotive-1', tags: 'node' }) });

    const second = await request('POST', '/api/jobs/feed/p1/save');
    expect((await second.json()).savedJob.id).toBe('sj-existing');
    expect(db.savedJob.create).toHaveBeenCalledTimes(1);
    expect(db.jobPosting.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { status: 'saved' } });
  });

  it('starts an ingestion run in the background, refusing overlaps', async () => {
    expect((await request('POST', '/api/jobs/feed/ingest')).status).toBe(202);
    expect(feed.runIngest).toHaveBeenCalledTimes(1);

    feed.isIngestRunning.mockResolvedValue(true);
    expect((await request('POST', '/api/jobs/feed/ingest')).status).toBe(409);
    expect(feed.runIngest).toHaveBeenCalledTimes(1);
  });
});
