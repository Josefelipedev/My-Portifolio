// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  applicationPackage: { findUnique: vi.fn(), update: vi.fn() },
  applicationArtifact: { create: vi.fn() },
  jobApplication: { findUnique: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(),
}));

const email = vi.hoisted(() => ({ sendEmail: vi.fn() }));

vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/email', () => email);

import { sendApplicationPackage, verifyPackagePdf } from '../../../apps/api/src/lib/jobs/application-package';

const PDF_BASE64 = Buffer.from('%PDF-1.4 fake').toString('base64');

function buildPackage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    version: 2,
    status: 'ready',
    reviewStatus: 'passed',
    atsStatus: 'passed',
    savedJob: {
      id: 'j1',
      title: 'Backend Engineer',
      company: 'Acme',
      url: 'https://acme.test/jobs/1',
      location: 'Lisboa',
      salary: null,
      contactEmail: 'jobs@acme.test',
    },
    artifacts: [
      { kind: 'email', content: JSON.stringify({ subject: 'Application — Backend Engineer', body: 'Hello,\nregards' }), sha256: null, metadata: null },
      { kind: 'cv_pdf', content: PDF_BASE64, sha256: 'abc123', metadata: JSON.stringify({ filename: 'cv-acme.pdf', size: 13 }) },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.jobApplication.findUnique.mockResolvedValue(null);
  db.jobApplication.upsert.mockResolvedValue({ id: 'a1', status: 'applied' });
  db.applicationArtifact.create.mockImplementation((args: unknown) => args);
  db.applicationPackage.update.mockImplementation((args: unknown) => args);
  db.$transaction.mockImplementation(async () => [
    {},
    { id: 'p1', version: 2, status: 'sent', recipient: 'jobs@acme.test', artifacts: [] },
  ]);
  email.sendEmail.mockResolvedValue(true);
});

describe('sendApplicationPackage', () => {
  it('sends the archived e-mail with the archived PDF and links the application', async () => {
    db.applicationPackage.findUnique.mockResolvedValue(buildPackage());

    const result = await sendApplicationPackage('p1', {});

    expect(result.emailed).toBe(true);
    expect(email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jobs@acme.test',
        subject: 'Application — Backend Engineer',
        text: 'Hello,\nregards',
        attachments: [expect.objectContaining({ filename: 'cv-acme.pdf', contentType: 'application/pdf' })],
      }),
    );
    expect(db.jobApplication.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { savedJobId: 'j1' },
        update: expect.objectContaining({ status: 'applied', emailSentTo: 'jobs@acme.test' }),
      }),
    );
    expect(db.applicationPackage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'sent', applicationId: 'a1', recipient: 'jobs@acme.test' }) }),
    );
  });

  it('archives the exact outbound e-mail as an immutable artifact', async () => {
    db.applicationPackage.findUnique.mockResolvedValue(buildPackage());

    await sendApplicationPackage('p1', {});

    const artifact = db.applicationArtifact.create.mock.calls[0][0].data;
    expect(artifact.kind).toBe('sent_email');
    expect(JSON.parse(artifact.content)).toMatchObject({
      channel: 'email',
      emailed: true,
      recipient: 'jobs@acme.test',
      subject: 'Application — Backend Engineer',
      body: 'Hello,\nregards',
      applicationId: 'a1',
      attachment: { filename: 'cv-acme.pdf', sha256: 'abc123', attached: true },
    });
  });

  it('refuses to send a package twice', async () => {
    db.applicationPackage.findUnique.mockResolvedValue(buildPackage({ status: 'sent' }));
    await expect(sendApplicationPackage('p1', {})).rejects.toMatchObject({ statusCode: 409 });
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('requires explicit acknowledgement when review or ATS did not pass', async () => {
    db.applicationPackage.findUnique.mockResolvedValue(buildPackage({ reviewStatus: 'needs_changes' }));
    await expect(sendApplicationPackage('p1', {})).rejects.toMatchObject({ statusCode: 409 });

    db.applicationPackage.findUnique.mockResolvedValue(buildPackage({ reviewStatus: 'needs_changes' }));
    const result = await sendApplicationPackage('p1', { acknowledgedWarnings: true });
    expect(result.emailed).toBe(true);
    const artifact = db.applicationArtifact.create.mock.calls[0][0].data;
    expect(JSON.parse(artifact.content)).toMatchObject({ acknowledgedWarnings: true, reviewStatusAtSend: 'needs_changes' });
  });

  it('requires a verified PDF before e-mailing', async () => {
    db.applicationPackage.findUnique.mockResolvedValue(
      buildPackage({ artifacts: [{ kind: 'email', content: JSON.stringify({ subject: 's', body: 'b' }), sha256: null, metadata: null }] }),
    );
    await expect(sendApplicationPackage('p1', {})).rejects.toMatchObject({ statusCode: 400 });
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('requires a recipient when e-mailing', async () => {
    const pkg = buildPackage();
    pkg.savedJob.contactEmail = null as unknown as string;
    db.applicationPackage.findUnique.mockResolvedValue(pkg);
    await expect(sendApplicationPackage('p1', {})).rejects.toMatchObject({ statusCode: 400 });
  });

  it('records a portal submission without sending or attaching anything', async () => {
    db.applicationPackage.findUnique.mockResolvedValue(
      buildPackage({ atsStatus: 'pending', artifacts: [] }),
    );

    const result = await sendApplicationPackage('p1', { sendEmail: false, acknowledgedWarnings: true });

    expect(result.emailed).toBe(false);
    expect(email.sendEmail).not.toHaveBeenCalled();
    const artifact = db.applicationArtifact.create.mock.calls[0][0].data;
    expect(JSON.parse(artifact.content)).toMatchObject({ channel: 'manual', emailed: false, recipient: null });
    expect(db.applicationPackage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'sent', recipient: null }) }),
    );
  });

  it('leaves the package editable when SMTP delivery fails', async () => {
    db.applicationPackage.findUnique.mockResolvedValue(buildPackage());
    email.sendEmail.mockResolvedValue(false);

    await expect(sendApplicationPackage('p1', {})).rejects.toMatchObject({ statusCode: 502 });
    expect(db.jobApplication.upsert).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('appends to the existing application timeline instead of replacing it', async () => {
    db.applicationPackage.findUnique.mockResolvedValue(buildPackage());
    db.jobApplication.findUnique.mockResolvedValue({
      id: 'a1',
      timeline: JSON.stringify([{ status: 'saved', date: '2026-01-01T00:00:00.000Z', note: 'Saved' }]),
    });

    await sendApplicationPackage('p1', {});

    const timeline = JSON.parse(db.jobApplication.upsert.mock.calls[0][0].update.timeline);
    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toMatchObject({ status: 'saved' });
    expect(timeline[1]).toMatchObject({ status: 'applied', note: expect.stringContaining('v2') });
  });
});

describe('verifyPackagePdf', () => {
  it('refuses to rewrite the archive of an already-sent package', async () => {
    db.applicationPackage.findUnique.mockResolvedValue({ ...buildPackage({ status: 'sent' }), artifacts: [] });
    await expect(verifyPackagePdf('p1', PDF_BASE64, 'cv.pdf')).rejects.toMatchObject({ statusCode: 409 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
