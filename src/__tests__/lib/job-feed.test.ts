// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  jobIngestRun: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  jobPosting: { findMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));
const email = vi.hoisted(() => ({ sendEmail: vi.fn() }));
const aggregator = vi.hoisted(() => ({ searchJobs: vi.fn(), getLastSourceErrors: vi.fn() }));
const semantic = vi.hoisted(() => ({ embedTexts: vi.fn(), getProfileEmbedding: vi.fn() }));
const resumeData = vi.hoisted(() => ({ loadFullResumeData: vi.fn() }));

vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/email', () => email);
vi.mock('../../../apps/api/src/lib/jobs/aggregator', () => aggregator);
vi.mock('../../../apps/api/src/lib/jobs/resume-data', () => resumeData);
vi.mock('../../../apps/api/src/lib/jobs/semantic', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../apps/api/src/lib/jobs/semantic')>()),
  ...semantic,
  EMBED_MODEL: 'qwen3-embedding:0.6b',
}));

import {
  buildIngestQueries,
  computeMatchScore,
  digestHtml,
  findDealBreaker,
  runDigest,
  runIngest,
} from '../../../apps/api/src/lib/jobs/feed';
import { cleanHtmlText } from '../../../apps/api/src/lib/jobs/helpers';
import type { JobListing, ResumeData } from '../../../apps/api/src/lib/jobs/types';

const resume: ResumeData = {
  personalInfo: { name: 'Dev', email: 'dev@example.com' },
  skills: [{ name: 'Node.js', level: 5, category: 'backend' }, { name: 'TypeScript', level: 5, category: 'backend' }],
  experience: [{ title: 'Software Engineer', company: 'Acme', responsibilities: ['Built APIs'] }],
  certifications: [],
  preferences: { targetRoles: ['Backend Engineer'], dealBreakers: ['on-call'] },
};

function listing(overrides: Partial<JobListing> = {}): JobListing {
  return {
    id: 'remotive-1',
    source: 'remotive',
    title: 'Backend Engineer',
    company: 'Acme',
    description: 'Node.js and TypeScript APIs',
    url: 'https://acme.test/jobs/1',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.jobIngestRun.create.mockResolvedValue({ id: 'run1' });
  db.jobPosting.createMany.mockResolvedValue({ count: 0 });
  db.jobPosting.updateMany.mockResolvedValue({ count: 0 });
  db.$transaction.mockImplementation(async (ops: unknown[]) => ops);
  db.jobPosting.update.mockImplementation((args: unknown) => args);
  aggregator.getLastSourceErrors.mockReturnValue([]);
  resumeData.loadFullResumeData.mockResolvedValue(resume);
  semantic.getProfileEmbedding.mockResolvedValue([1, 0]);
  semantic.embedTexts.mockImplementation(async (texts: string[]) => texts.map(() => [1, 0]));
});

describe('computeMatchScore', () => {
  it('stays within 0-100 and rewards semantic similarity', () => {
    expect(computeMatchScore(0, 0.1)).toBe(0);
    expect(computeMatchScore(1000, 0.99)).toBe(100);
    expect(computeMatchScore(20, 0.6)).toBeGreaterThan(computeMatchScore(20, 0.4));
  });

  it('falls back to the keyword score without an embedding', () => {
    expect(computeMatchScore(20, null)).toBe(50);
  });
});

describe('findDealBreaker', () => {
  it('returns the matching preference term, case-insensitively', () => {
    expect(findDealBreaker(listing({ description: 'Includes On-Call rotations' }), resume)).toBe('on-call');
    expect(findDealBreaker(listing(), resume)).toBeNull();
  });
});

describe('buildIngestQueries', () => {
  it('puts target roles first, dedupes and caps the list', () => {
    const queries = buildIngestQueries(resume);
    expect(queries[0]).toBe('backend engineer');
    expect(new Set(queries).size).toBe(queries.length);
    expect(queries.length).toBeLessThanOrEqual(6);
  });
});

describe('cleanHtmlText', () => {
  it('decodes numeric entities from scraped titles', () => {
    expect(cleanHtmlText('&#128188; Estamos a Recrutar &#x2014; Dev')).toBe('💼 Estamos a Recrutar — Dev');
  });
});

describe('runIngest', () => {
  it('creates new postings, refreshes and widens existing ones, and scores them', async () => {
    aggregator.searchJobs.mockResolvedValue([
      listing(),
      listing({ id: 'linkedin-9', source: 'linkedin', description: 'short' }),
      listing({ id: 'itjobs-2', source: 'itjobs', title: 'Frontend Dev', company: 'Beta', url: 'https://beta.test/2' }),
    ]);
    db.jobPosting.findMany
      // existing rows by fingerprint
      .mockResolvedValueOnce([{ id: 'p-old', fingerprint: 'backendengineer-acme', sources: ['remotive'] }])
      // first page to score, then an empty page
      .mockResolvedValueOnce([
        { id: 'p-old', externalId: 'remotive-1', source: 'remotive', title: 'Backend Engineer', company: 'Acme', description: 'Node.js', url: 'u', location: null, tags: [], embedding: [], embeddingModel: null },
      ])
      .mockResolvedValueOnce([]);
    db.jobPosting.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 2 });

    const result = await runIngest();

    expect(result).toMatchObject({ found: 2, created: 1, updated: 1, closed: 2, scored: 1 });
    const created = db.jobPosting.createMany.mock.calls[0][0].data;
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ fingerprint: 'frontenddev-beta', sources: ['itjobs'] });
    // the duplicate seen on LinkedIn widens the stored sources
    expect(db.jobPosting.update).toHaveBeenCalledWith({ where: { id: 'p-old' }, data: { sources: ['remotive', 'linkedin'] } });
    const scoreUpdate = db.jobPosting.update.mock.calls.find((call) => call[0].data.profileHash)![0];
    expect(scoreUpdate.data).toMatchObject({ embedding: [1, 0], embeddingModel: 'qwen3-embedding:0.6b', semanticScore: 1, dealBreaker: null });
    expect(db.jobIngestRun.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'run1' } }));
  });

  it('records source failures without aborting the run', async () => {
    aggregator.searchJobs.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([]);
    aggregator.getLastSourceErrors.mockReturnValue([{ source: 'Jobicy', error: '400' }]);
    db.jobPosting.findMany.mockResolvedValue([]);

    const result = await runIngest();

    expect(result.errors).toEqual(expect.arrayContaining(['backend engineer: boom', 'Jobicy: 400']));
    const finished = db.jobIngestRun.update.mock.calls[0][0].data;
    expect(JSON.parse(finished.errors)).toEqual(result.errors);
  });
});

describe('runDigest', () => {
  const job = { id: 'p1', title: '<b>Dev</b>', company: 'A&B', location: 'Lisboa', url: 'javascript:alert(1)', matchScore: 80, salary: null };

  it('escapes posting content and neutralises non-http links', () => {
    const html = digestHtml([job], 'https://example.test/feed');
    expect(html).toContain('&lt;b&gt;Dev&lt;/b&gt;');
    expect(html).toContain('A&amp;B');
    expect(html).not.toContain('javascript:');
  });

  it('marks postings as digested only when the e-mail went out', async () => {
    process.env.ALERT_EMAIL = 'me@example.com';
    db.jobPosting.findMany.mockResolvedValue([job]);
    email.sendEmail.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    expect(await runDigest()).toEqual({ sent: 0, emailed: false });
    expect(db.jobPosting.updateMany).not.toHaveBeenCalled();

    expect(await runDigest()).toEqual({ sent: 1, emailed: true });
    expect(db.jobPosting.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['p1'] } } }));
  });

  it('sends nothing when there are no new strong postings', async () => {
    db.jobPosting.findMany.mockResolvedValue([]);
    expect(await runDigest()).toEqual({ sent: 0, emailed: false });
    expect(email.sendEmail).not.toHaveBeenCalled();
  });
});
