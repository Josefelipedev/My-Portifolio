// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
});

const db = vi.hoisted(() => ({
  session: { findFirst: vi.fn() },
  applicationPackage: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  applicationArtifact: { findFirst: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));

const packageService = vi.hoisted(() => ({
  createApplicationPackage: vi.fn(),
  verifyPackagePdf: vi.fn(),
  sendApplicationPackage: vi.fn(),
  serializePackage: vi.fn((value: unknown) => value),
}));

vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/jobs/application-package', () => packageService);

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

beforeEach(() => {
  vi.clearAllMocks();
  db.session.findFirst.mockResolvedValue({ id: 's', userId: 'u1', token: 's1', isValid: true });
});

describe('application packages', () => {
  it('requires authentication', async () => {
    const response = await app.fetch(new Request('http://local/api/jobs/saved/j1/application-packages'));
    expect(response.status).toBe(401);
  });

  it('lists versioned packages for a saved job', async () => {
    db.applicationPackage.findMany.mockResolvedValue([{ id: 'p1', version: 2, artifacts: [] }]);
    const response = await request('GET', '/api/jobs/saved/j1/application-packages');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ packages: [{ id: 'p1', version: 2 }] });
  });

  it('prepares and independently reviews a new version', async () => {
    packageService.createApplicationPackage.mockResolvedValue({ id: 'p2', version: 3, artifacts: [] });
    const response = await request('POST', '/api/jobs/saved/j1/application-packages');
    expect(response.status).toBe(201);
    expect(packageService.createApplicationPackage).toHaveBeenCalledWith('j1');
    expect(await response.json()).toMatchObject({ package: { id: 'p2', version: 3 } });
  });

  it('validates and ATS-checks an uploaded PDF', async () => {
    packageService.verifyPackagePdf.mockResolvedValue({ passed: true, totalPages: 2 });
    const response = await request('POST', '/api/jobs/application-packages/p1/verify-pdf', {
      cvPdfBase64: 'a'.repeat(200),
      filename: 'cv.pdf',
    });
    expect(response.status).toBe(200);
    expect(packageService.verifyPackagePdf).toHaveBeenCalledWith('p1', 'a'.repeat(200), 'cv.pdf');
    expect(await response.json()).toMatchObject({ report: { passed: true, totalPages: 2 } });
  });

  it('sends an approved package and returns the linked application', async () => {
    packageService.sendApplicationPackage.mockResolvedValue({
      package: { id: 'p1', status: 'sent' },
      application: { id: 'a1', status: 'applied' },
      emailed: true,
    });
    const response = await request('POST', '/api/jobs/application-packages/p1/send', {
      recipient: 'jobs@acme.test',
      acknowledgedWarnings: true,
    });
    expect(response.status).toBe(201);
    expect(packageService.sendApplicationPackage).toHaveBeenCalledWith('p1', {
      recipient: 'jobs@acme.test',
      acknowledgedWarnings: true,
    });
    expect(await response.json()).toMatchObject({ package: { status: 'sent' }, application: { id: 'a1' }, emailed: true });
  });

  it('rejects an invalid recipient e-mail before touching the service', async () => {
    const response = await request('POST', '/api/jobs/application-packages/p1/send', { recipient: 'not-an-email' });
    expect(response.status).toBe(400);
    expect(packageService.sendApplicationPackage).not.toHaveBeenCalled();
  });
});
