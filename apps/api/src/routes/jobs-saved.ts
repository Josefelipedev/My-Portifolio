// Jobs — saved-jobs CRUD + stats. Ported from the web app's
// src/app/api/jobs/{saved,saved/[id],saved/bulk,stats} handlers. Query logic
// kept identical. Reads require auth; mutations also require CSRF.

import { Hono } from 'hono';
import prisma from '../db';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';
import { Errors, validateRequired } from '../lib/api-utils';

const jobs = new Hono<AuthEnv>();

// ---- list (paginated) ----
jobs.get('/jobs/saved', requireAuth, async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50', 10)));
  const skip = (page - 1) * limit;

  const [savedJobs, total] = await Promise.all([
    prisma.savedJob.findMany({
      orderBy: { savedAt: 'desc' },
      skip,
      take: limit,
      include: { application: { select: { id: true, status: true, appliedAt: true } } },
    }),
    prisma.savedJob.count(),
  ]);

  return c.json({
    jobs: savedJobs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasMore: skip + savedJobs.length < total,
  });
});

// ---- create ----
jobs.post('/jobs/saved', requireAuth, requireCsrf, async (c) => {
  const data = (await c.req.json()) as Record<string, unknown>;
  validateRequired(data, ['externalId', 'source', 'title', 'company', 'url']);

  const existing = await prisma.savedJob.findUnique({ where: { externalId: String(data.externalId) } });
  if (existing) throw Errors.BadRequest('Job already saved');

  const tags = data.tags ? (Array.isArray(data.tags) ? data.tags.join(',') : String(data.tags)) : null;
  const savedJob = await prisma.savedJob.create({
    data: {
      externalId: String(data.externalId),
      source: String(data.source),
      title: String(data.title),
      company: String(data.company),
      companyLogo: (data.companyLogo as string) ?? undefined,
      description: (data.description as string) || '',
      url: String(data.url),
      location: (data.location as string) ?? undefined,
      jobType: (data.jobType as string) ?? undefined,
      salary: (data.salary as string) ?? undefined,
      tags,
      postedAt: data.postedAt ? new Date(data.postedAt as string) : null,
      notes: (data.notes as string) ?? undefined,
    },
  });
  return c.json(savedJob, 201);
});

// ---- bulk delete (must be registered before /jobs/saved/:id) ----
jobs.delete('/jobs/saved/bulk', requireAuth, requireCsrf, async (c) => {
  const { ids } = (await c.req.json()) as { ids?: unknown };
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw Errors.BadRequest('IDs array is required');
  }
  await prisma.jobApplication.deleteMany({ where: { savedJobId: { in: ids as string[] } } });
  const result = await prisma.savedJob.deleteMany({ where: { id: { in: ids as string[] } } });
  return c.json({ message: `${result.count} jobs deleted`, count: result.count });
});

// ---- single get ----
jobs.get('/jobs/saved/:id', requireAuth, async (c) => {
  const savedJob = await prisma.savedJob.findUnique({
    where: { id: c.req.param('id') },
    include: { application: true },
  });
  if (!savedJob) throw Errors.NotFound('Saved job not found');
  return c.json(savedJob);
});

// ---- update (partial: notes/contact only) ----
jobs.put('/jobs/saved/:id', requireAuth, requireCsrf, async (c) => {
  const data = (await c.req.json()) as Record<string, unknown>;
  const updateData: { notes?: string; contactEmail?: string | null; contactPhone?: string | null } = {};
  if (data.notes !== undefined) updateData.notes = data.notes as string;
  if (data.contactEmail !== undefined) updateData.contactEmail = (data.contactEmail as string) || null;
  if (data.contactPhone !== undefined) updateData.contactPhone = (data.contactPhone as string) || null;

  try {
    const savedJob = await prisma.savedJob.update({ where: { id: c.req.param('id') }, data: updateData });
    return c.json(savedJob);
  } catch {
    throw Errors.NotFound('Saved job not found');
  }
});

// ---- delete ----
jobs.delete('/jobs/saved/:id', requireAuth, requireCsrf, async (c) => {
  try {
    await prisma.savedJob.delete({ where: { id: c.req.param('id') } });
    return c.body(null, 204);
  } catch {
    throw Errors.NotFound('Saved job not found');
  }
});

// ---- pipeline stats ----
jobs.get('/jobs/stats', requireAuth, async (c) => {
  const [savedJobsCount, saved, applied, interview, offer, rejected, recentApplications, upcomingSteps] =
    await Promise.all([
      prisma.savedJob.count(),
      prisma.jobApplication.count({ where: { status: 'saved' } }),
      prisma.jobApplication.count({ where: { status: 'applied' } }),
      prisma.jobApplication.count({ where: { status: 'interview' } }),
      prisma.jobApplication.count({ where: { status: 'offer' } }),
      prisma.jobApplication.count({ where: { status: 'rejected' } }),
      prisma.jobApplication.findMany({
        where: { appliedAt: { not: null } },
        orderBy: { appliedAt: 'desc' },
        take: 5,
        select: { id: true, title: true, company: true, status: true, appliedAt: true },
      }),
      prisma.jobApplication.findMany({
        where: { nextStepDate: { gte: new Date() } },
        orderBy: { nextStepDate: 'asc' },
        take: 5,
        select: { id: true, title: true, company: true, nextStep: true, nextStepDate: true },
      }),
    ]);

  return c.json({
    savedJobs: savedJobsCount,
    applications: {
      saved,
      applied,
      interview,
      offer,
      rejected,
      total: saved + applied + interview + offer + rejected,
    },
    recentApplications,
    upcomingSteps,
  });
});

export default jobs;
