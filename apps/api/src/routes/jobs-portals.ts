// Jobs — company ATS portals (Greenhouse/Ashby/Lever). CRUD + scan. Ported from
// the web app's src/app/api/jobs/portals/{route,[id]/route,scan/route}. Reads
// require auth; mutations also require CSRF.

import { Hono } from 'hono';
import prisma from '../db';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';
import { detectPortalType, scanAllPortals } from '../lib/jobs/portal-scanner';
import { parseBody } from '../lib/api-utils';
import { portalCreateSchema, portalUpdateSchema } from '../schemas/jobs';

const jobsPortals = new Hono<AuthEnv>();

// ---- list ----
jobsPortals.get('/jobs/portals', requireAuth, async (c) => {
  const portals = await prisma.companyPortal.findMany({
    orderBy: [{ isActive: 'desc' }, { company: 'asc' }],
  });
  return c.json(portals);
});

// ---- create ----
jobsPortals.post('/jobs/portals', requireAuth, requireCsrf, async (c) => {
  const body = await parseBody(c, portalCreateSchema);

  const detected = detectPortalType(body.careersUrl);
  const portal = await prisma.companyPortal.create({
    data: {
      company: body.company,
      careersUrl: body.careersUrl,
      portalType: body.portalType || detected.type,
      portalSlug: body.portalSlug || detected.slug,
      titleFilters: body.titleFilters ? JSON.stringify(body.titleFilters) : null,
    },
  });
  return c.json(portal, 201);
});

// ---- scan all (registered before :id so "scan" isn't treated as an id) ----
jobsPortals.post('/jobs/portals/scan', requireAuth, requireCsrf, async (c) => {
  const results = await scanAllPortals();
  const totalNew = results.reduce((sum, r) => sum + r.newJobs.length, 0);
  const totalFound = results.reduce((sum, r) => sum + r.totalFound, 0);
  const errors = results.flatMap((r) => r.errors.map((e) => `${r.company}: ${e}`));

  return c.json({
    success: true,
    summary: {
      companiesScanned: results.length,
      totalJobsFound: totalFound,
      newJobsFound: totalNew,
      errors,
    },
    results: results.map((r) => ({
      company: r.company,
      portalType: r.portalType,
      totalFound: r.totalFound,
      newJobs: r.newJobs.length,
      jobTitles: r.newJobs.slice(0, 5).map((j) => j.title),
      errors: r.errors,
    })),
  });
});

// ---- get one ----
jobsPortals.get('/jobs/portals/:id', requireAuth, async (c) => {
  const portal = await prisma.companyPortal.findUnique({ where: { id: c.req.param('id') } });
  if (!portal) return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404);
  return c.json(portal);
});

// ---- update ----
jobsPortals.put('/jobs/portals/:id', requireAuth, requireCsrf, async (c) => {
  const body = await parseBody(c, portalUpdateSchema);

  const updateData: Record<string, unknown> = {};
  if (body.company !== undefined) updateData.company = body.company;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;
  if (body.titleFilters !== undefined) updateData.titleFilters = JSON.stringify(body.titleFilters);

  if (body.careersUrl !== undefined) {
    updateData.careersUrl = body.careersUrl;
    const detected = detectPortalType(body.careersUrl);
    updateData.portalType = body.portalType || detected.type;
    updateData.portalSlug = body.portalSlug || detected.slug;
  } else {
    if (body.portalType !== undefined) updateData.portalType = body.portalType;
    if (body.portalSlug !== undefined) updateData.portalSlug = body.portalSlug;
  }

  try {
    const portal = await prisma.companyPortal.update({
      where: { id: c.req.param('id') },
      data: updateData,
    });
    return c.json(portal);
  } catch {
    return c.json({ error: 'Failed to update portal', code: 'NOT_FOUND' }, 404);
  }
});

// ---- delete ----
jobsPortals.delete('/jobs/portals/:id', requireAuth, requireCsrf, async (c) => {
  try {
    await prisma.companyPortal.delete({ where: { id: c.req.param('id') } });
    return c.json({ success: true });
  } catch {
    return c.json({ error: 'Failed to delete portal', code: 'NOT_FOUND' }, 404);
  }
});

export default jobsPortals;
