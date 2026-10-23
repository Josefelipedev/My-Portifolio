// Jobs — the ingested feed (JobPosting rows scored against the resume by the
// cron in lib/jobs/feed.ts). Reads require auth; mutations also require CSRF.

import { Hono } from 'hono';
import prisma from '../db';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';
import { Errors, parseBody } from '../lib/api-utils';
import { jobFeedStatusSchema } from '../schemas/jobs';
import { isIngestRunning, runIngest } from '../lib/jobs/feed';

const feed = new Hono<AuthEnv>();

const DAY_MS = 24 * 60 * 60 * 1000;
const FEED_STATUSES = new Set(['new', 'saved', 'dismissed', 'all']);

// Everything but the embedding, which is large and only used server-side.
const postingSelect = {
  id: true, externalId: true, source: true, sources: true, title: true, company: true,
  companyLogo: true, description: true, url: true, location: true, jobType: true,
  salary: true, tags: true, country: true, postedAt: true, firstSeenAt: true,
  lastSeenAt: true, keywordScore: true, semanticScore: true, matchScore: true,
  dealBreaker: true, status: true,
} as const;

function intParam(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = parseInt(value || '', 10);
  return Number.isNaN(parsed) ? fallback : Math.min(max, Math.max(min, parsed));
}

feed.get('/jobs/feed', requireAuth, async (c) => {
  const days = intParam(c.req.query('days'), 7, 1, 90);
  const minScore = intParam(c.req.query('minScore'), 0, 0, 100);
  const page = intParam(c.req.query('page'), 1, 1, 1000);
  const limit = intParam(c.req.query('limit'), 50, 1, 100);
  const status = c.req.query('status') || 'new';
  if (!FEED_STATUSES.has(status)) throw Errors.BadRequest('Invalid status');
  const includeFiltered = c.req.query('includeFiltered') === 'true';

  const where = {
    closedAt: null,
    firstSeenAt: { gte: new Date(Date.now() - days * DAY_MS) },
    ...(minScore > 0 ? { matchScore: { gte: minScore } } : {}),
    ...(status !== 'all' ? { status } : {}),
    ...(includeFiltered ? {} : { dealBreaker: null }),
  };

  const [jobs, total, lastRun, running] = await Promise.all([
    prisma.jobPosting.findMany({
      where,
      orderBy: [{ matchScore: { sort: 'desc', nulls: 'last' } }, { firstSeenAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: postingSelect,
    }),
    prisma.jobPosting.count({ where }),
    prisma.jobIngestRun.findFirst({ where: { finishedAt: { not: null } }, orderBy: { startedAt: 'desc' } }),
    isIngestRunning(),
  ]);

  return c.json({
    jobs,
    total,
    page,
    limit,
    hasMore: page * limit < total,
    running,
    lastRun: lastRun && { ...lastRun, errors: lastRun.errors ? (JSON.parse(lastRun.errors) as string[]) : [] },
  });
});

// ---- start an ingestion pass (runs in the background; the cron uses the CLI) ----
feed.post('/jobs/feed/ingest', requireAuth, requireCsrf, async (c) => {
  if (await isIngestRunning()) throw Errors.Conflict('An ingestion run is already in progress');
  void runIngest().catch((error) => console.error('[feed] manual ingest failed:', error));
  return c.json({ started: true }, 202);
});

feed.post('/jobs/feed/:id/status', requireAuth, requireCsrf, async (c) => {
  const { status } = await parseBody(c, jobFeedStatusSchema);
  const posting = await prisma.jobPosting.findUnique({ where: { id: c.req.param('id') }, select: { id: true } });
  if (!posting) throw Errors.NotFound('Posting not found');
  const updated = await prisma.jobPosting.update({ where: { id: posting.id }, data: { status }, select: postingSelect });
  return c.json(updated);
});

// ---- save into Saved Jobs (idempotent: an already-saved externalId is reused) ----
feed.post('/jobs/feed/:id/save', requireAuth, requireCsrf, async (c) => {
  const posting = await prisma.jobPosting.findUnique({ where: { id: c.req.param('id') } });
  if (!posting) throw Errors.NotFound('Posting not found');

  const savedJob =
    (await prisma.savedJob.findUnique({ where: { externalId: posting.externalId } })) ??
    (await prisma.savedJob.create({
      data: {
        externalId: posting.externalId,
        source: posting.source,
        title: posting.title,
        company: posting.company,
        companyLogo: posting.companyLogo ?? undefined,
        description: posting.description,
        url: posting.url,
        location: posting.location ?? undefined,
        jobType: posting.jobType ?? undefined,
        salary: posting.salary ?? undefined,
        tags: posting.tags.length ? posting.tags.join(',') : null,
        postedAt: posting.postedAt,
      },
    }));

  await prisma.jobPosting.update({ where: { id: posting.id }, data: { status: 'saved' } });
  return c.json({ savedJob }, 201);
});

export default feed;
