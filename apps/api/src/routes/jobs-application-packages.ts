import { Hono } from 'hono';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';
import { parseBody } from '../lib/api-utils';
import prisma from '../db';
import {
  applicationPackagePdfSchema,
  applicationPackageSendSchema,
  applicationPackageUpdateSchema,
} from '../schemas/jobs';
import {
  createApplicationPackage,
  parseJson,
  sendApplicationPackage,
  serializePackage,
  verifyPackagePdf,
} from '../lib/jobs/application-package';

const packages = new Hono<AuthEnv>();

packages.get('/jobs/saved/:id/application-packages', requireAuth, async (c) => {
  const rows = await prisma.applicationPackage.findMany({
    where: { savedJobId: c.req.param('id') },
    include: { artifacts: { orderBy: { createdAt: 'asc' } } },
    orderBy: { version: 'desc' },
  });
  return c.json({ packages: rows.map(serializePackage) });
});

packages.post('/jobs/saved/:id/application-packages', requireAuth, requireCsrf, async (c) => {
  const result = await createApplicationPackage(c.req.param('id'));
  return c.json({ package: serializePackage(result) }, 201);
});

packages.get('/jobs/application-packages/:id', requireAuth, async (c) => {
  const row = await prisma.applicationPackage.findUnique({
    where: { id: c.req.param('id') },
    include: { artifacts: { orderBy: { createdAt: 'asc' } } },
  });
  if (!row) return c.json({ error: 'Application package not found' }, 404);
  return c.json({ package: serializePackage(row) });
});

packages.put('/jobs/application-packages/:id', requireAuth, requireCsrf, async (c) => {
  const body = await parseBody(c, applicationPackageUpdateSchema);
  const id = c.req.param('id');
  const current = await prisma.applicationPackage.findUnique({ where: { id }, select: { status: true } });
  if (!current) return c.json({ error: 'Application package not found' }, 404);
  if (current.status === 'sent') return c.json({ error: 'Sent application packages are immutable; create a new version instead' }, 409);
  const writes = [];
  if (body.coverLetter) {
    writes.push(prisma.applicationArtifact.deleteMany({ where: { packageId: id, kind: 'cover_letter' } }));
    writes.push(prisma.applicationArtifact.create({ data: { packageId: id, kind: 'cover_letter', content: body.coverLetter, mimeType: 'text/plain' } }));
  }
  if (body.emailSubject || body.emailBody) {
    const existing = await prisma.applicationArtifact.findFirst({
      where: { packageId: id, kind: 'email' },
      orderBy: { createdAt: 'desc' },
    });
    const email = parseJson<{ subject?: string; body?: string }>(existing?.content, {});
    writes.push(prisma.applicationArtifact.deleteMany({ where: { packageId: id, kind: 'email' } }));
    writes.push(prisma.applicationArtifact.create({
      data: {
        packageId: id,
        kind: 'email',
        content: JSON.stringify({
          subject: body.emailSubject || email.subject || '',
          body: body.emailBody || email.body || '',
        }),
        mimeType: 'application/json',
      },
    }));
  }
  if (body.status) {
    writes.push(prisma.applicationPackage.update({ where: { id }, data: { status: body.status } }));
  }
  if (writes.length) await prisma.$transaction(writes);
  const updated = await prisma.applicationPackage.findUniqueOrThrow({
    where: { id },
    include: { artifacts: { orderBy: { createdAt: 'asc' } } },
  });
  return c.json({ package: serializePackage(updated) });
});

packages.post('/jobs/application-packages/:id/verify-pdf', requireAuth, requireCsrf, async (c) => {
  const body = await parseBody(c, applicationPackagePdfSchema);
  const report = await verifyPackagePdf(c.req.param('id'), body.cvPdfBase64, body.filename);
  return c.json({ report });
});

// Explicit user approval: freezes the version, links it to the JobApplication
// and archives the exact outbound e-mail. `sendEmail: false` records a
// submission made on a company portal without delivering anything.
packages.post('/jobs/application-packages/:id/send', requireAuth, requireCsrf, async (c) => {
  const body = await parseBody(c, applicationPackageSendSchema);
  const result = await sendApplicationPackage(c.req.param('id'), body);
  return c.json(result, 201);
});

export default packages;
