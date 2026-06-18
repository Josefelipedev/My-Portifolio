// Jobs — applications CRUD + bulk ops. Ported from the web app's
// src/app/api/jobs/applications/{route,[id]/route,bulk/route} handlers. Query
// logic kept identical. Reads require auth; mutations also require CSRF.

import { Hono } from 'hono';
import prisma from '../db';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';
import { Errors, validateRequired } from '../lib/api-utils';

const jobsApplications = new Hono<AuthEnv>();

const VALID_STATUSES = ['saved', 'applied', 'interview', 'offer', 'rejected'];

// ---- list (optional status filter) ----
jobsApplications.get('/jobs/applications', requireAuth, async (c) => {
  const status = c.req.query('status');
  const where = status ? { status } : {};

  const applications = await prisma.jobApplication.findMany({
    where,
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    include: {
      savedJob: {
        select: { id: true, companyLogo: true, tags: true },
      },
    },
  });

  return c.json(applications);
});

// ---- create (manual application, without saved job) ----
jobsApplications.post('/jobs/applications', requireAuth, requireCsrf, async (c) => {
  const data = (await c.req.json()) as Record<string, unknown>;
  validateRequired(data, ['title', 'company']);

  const status = (data.status as string) || 'saved';
  const application = await prisma.jobApplication.create({
    data: {
      title: data.title as string,
      company: data.company as string,
      url: data.url as string | undefined,
      location: data.location as string | undefined,
      salary: data.salary as string | undefined,
      status,
      appliedAt: data.appliedAt ? new Date(data.appliedAt as string) : null,
      notes: data.notes as string | undefined,
      timeline: JSON.stringify([
        {
          status,
          date: new Date().toISOString(),
          note: 'Application created manually',
        },
      ]),
      nextStep: data.nextStep as string | undefined,
      nextStepDate: data.nextStepDate ? new Date(data.nextStepDate as string) : null,
    },
  });

  return c.json(application, 201);
});

// ---- bulk delete (must be registered before /jobs/applications/:id) ----
jobsApplications.delete('/jobs/applications/bulk', requireAuth, requireCsrf, async (c) => {
  const { ids } = (await c.req.json()) as { ids?: unknown };
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw Errors.BadRequest('IDs array is required');
  }

  const result = await prisma.jobApplication.deleteMany({
    where: { id: { in: ids as string[] } },
  });

  return c.json({
    message: `${result.count} applications deleted`,
    count: result.count,
  });
});

// ---- bulk update status (must be registered before /jobs/applications/:id) ----
jobsApplications.put('/jobs/applications/bulk', requireAuth, requireCsrf, async (c) => {
  const { ids, status } = (await c.req.json()) as { ids?: unknown; status?: unknown };
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw Errors.BadRequest('IDs array is required');
  }
  if (!status) {
    throw Errors.BadRequest('Status is required');
  }
  if (!VALID_STATUSES.includes(status as string)) {
    throw Errors.BadRequest('Invalid status');
  }

  // Get current applications to update their timelines.
  const applications = await prisma.jobApplication.findMany({
    where: { id: { in: ids as string[] } },
    select: { id: true, timeline: true },
  });

  const updates = applications.map((app) => {
    const currentTimeline = app.timeline ? JSON.parse(app.timeline) : [];
    currentTimeline.push({
      status,
      date: new Date().toISOString(),
      note: 'Bulk status update',
    });

    return prisma.jobApplication.update({
      where: { id: app.id },
      data: {
        status: status as string,
        timeline: JSON.stringify(currentTimeline),
        appliedAt:
          status === 'applied' &&
          !currentTimeline.some((t: { status: string }) => t.status === 'applied')
            ? new Date()
            : undefined,
      },
    });
  });

  await Promise.all(updates);

  return c.json({
    message: `${(ids as string[]).length} applications updated to ${status}`,
    count: (ids as string[]).length,
  });
});

// ---- single get ----
jobsApplications.get('/jobs/applications/:id', requireAuth, async (c) => {
  const application = await prisma.jobApplication.findUnique({
    where: { id: c.req.param('id') },
    include: { savedJob: true },
  });
  if (!application) throw Errors.NotFound('Application not found');
  return c.json(application);
});

// ---- update ----
jobsApplications.put('/jobs/applications/:id', requireAuth, requireCsrf, async (c) => {
  const id = c.req.param('id');
  const data = (await c.req.json()) as Record<string, unknown>;

  const current = await prisma.jobApplication.findUnique({ where: { id } });
  if (!current) throw Errors.NotFound('Application not found');

  // Update timeline if status changed.
  const timeline = current.timeline ? JSON.parse(current.timeline) : [];
  if (data.status && data.status !== current.status) {
    timeline.push({
      status: data.status,
      date: new Date().toISOString(),
      note: (data.statusNote as string) || `Status changed to ${data.status}`,
    });
  }

  const application = await prisma.jobApplication.update({
    where: { id },
    data: {
      title: data.title !== undefined ? (data.title as string) : current.title,
      company: data.company !== undefined ? (data.company as string) : current.company,
      url: data.url !== undefined ? (data.url as string) : current.url,
      location: data.location !== undefined ? (data.location as string) : current.location,
      salary: data.salary !== undefined ? (data.salary as string) : current.salary,
      status: (data.status as string) || current.status,
      appliedAt: data.appliedAt ? new Date(data.appliedAt as string) : current.appliedAt,
      notes: data.notes !== undefined ? (data.notes as string) : current.notes,
      timeline: JSON.stringify(timeline),
      nextStep: data.nextStep !== undefined ? (data.nextStep as string) : current.nextStep,
      nextStepDate:
        data.nextStepDate !== undefined
          ? data.nextStepDate
            ? new Date(data.nextStepDate as string)
            : null
          : current.nextStepDate,
    },
  });

  return c.json(application);
});

// ---- delete ----
jobsApplications.delete('/jobs/applications/:id', requireAuth, requireCsrf, async (c) => {
  await prisma.jobApplication.delete({ where: { id: c.req.param('id') } });
  return c.body(null, 204);
});

export default jobsApplications;
