// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const db = vi.hoisted(() => ({
  companyPortal: { findMany: vi.fn(), update: vi.fn(), createMany: vi.fn() },
  portalSeenJob: { findMany: vi.fn(), createMany: vi.fn() },
}));
vi.mock('../../../apps/api/src/db', () => ({ default: db }));

import {
  extractJobPageText,
  parseCareersPageJobs,
} from '../../../apps/api/src/lib/jobs/careers-page-parser';
import { scanAllPortals } from '../../../apps/api/src/lib/jobs/portal-scanner';
import {
  CONSULTANCY_PORTALS,
  seedConsultancyPortals,
} from '../../../apps/api/src/lib/jobs/consultancy-portals';

describe('parseCareersPageJobs', () => {
  it('takes the title from the heading inside a job card link', () => {
    const html = `
      <a href="https://www.fyld.pt/job-apply/5bc941735a/net-developer" class="job-listing">
        <h2>.Net Developer</h2><span class="location"></span><span class="type">Full Time</span>
      </a>`;

    expect(parseCareersPageJobs(html, 'https://www.fyld.pt/it-jobs/')).toEqual([
      { title: '.Net Developer', url: 'https://www.fyld.pt/job-apply/5bc941735a/net-developer' },
    ]);
  });

  it('resolves relative links on careers-page.com boards', () => {
    const html = `
      <a href="/humanit/job/3W3YR35V" class="text-secondary">
        <h5 class="job-position-break"> Senior Backend Developer (Node.js/TypeScript) - Full Remote Portugal </h5>
      </a>`;

    expect(parseCareersPageJobs(html, 'https://www.careers-page.com/humanit')).toEqual([
      {
        title: 'Senior Backend Developer (Node.js/TypeScript) - Full Remote Portugal',
        url: 'https://www.careers-page.com/humanit/job/3W3YR35V',
      },
    ]);
  });

  it('reads a title element and accepts another subdomain of the same site', () => {
    const html = `
      <a class="job-card" href="https://opportunities.noesis.pt/jobs/consultor-tibco-bw-suporte">
        <div class="content"><div class="info"><div class="title"> Consultor TIBCO BW (Suporte)</div>
        <div class="details"><span>Lisboa</span></div></div></div>
      </a>`;

    expect(parseCareersPageJobs(html, 'https://www.noesis.pt/join-us/job-opportunities')).toEqual([
      { title: 'Consultor TIBCO BW (Suporte)', url: 'https://opportunities.noesis.pt/jobs/consultor-tibco-bw-suporte' },
    ]);
  });

  it('builds the title from the slug when the link only says "View Role"', () => {
    const html = `<a class="btn" href="https://www.kwan.com/job-detail/backend-developer-golang-8571?hsLang=en">View Role</a>`;

    expect(parseCareersPageJobs(html, 'https://www.kwan.com/open-jobs')).toEqual([
      { title: 'Backend Developer Golang', url: 'https://www.kwan.com/job-detail/backend-developer-golang-8571' },
    ]);
  });

  it('keeps the real title when a card links to the same job twice', () => {
    const html = `
      <a href="/job-detail/fullstack-node-8600">View Role</a>
      <a href="/job-detail/fullstack-node-8600?hsLang=en"><h3>Fullstack Developer (Node.js &amp; React)</h3></a>`;

    expect(parseCareersPageJobs(html, 'https://www.kwan.com/open-jobs')).toEqual([
      { title: 'Fullstack Developer (Node.js & React)', url: 'https://www.kwan.com/job-detail/fullstack-node-8600' },
    ]);
  });

  it('ignores navigation, service pages, other sites and "Refer" sub-links', () => {
    const html = `
      <a href="/jobs">Jobs</a>
      <a href="https://www.mindsource.pt/data-ai-services/data-engineering">Data Engineering</a>
      <a href="https://www.linkedin.com/jobs/view/123">Backend Developer</a>
      <a href="mailto:jobs@example.pt">Send your CV</a>
      <a href="/jobs/3b0376ae-2993-4a5a-9b40-61cc9d92160f/refer">Refer</a>
      <a href="/jobs/3b0376ae-2993-4a5a-9b40-61cc9d92160f"><h6>Platform Engineer</h6></a>`;

    expect(parseCareersPageJobs(html, 'https://wire-it.careers-page.com/jobs')).toEqual([
      {
        title: 'Platform Engineer',
        url: 'https://wire-it.careers-page.com/jobs/3b0376ae-2993-4a5a-9b40-61cc9d92160f',
      },
    ]);
  });

  it('returns nothing for a page that renders its jobs in the browser', () => {
    const html = `<div id="app"></div><a href="/carreira">Carreira</a><a href="/contactos">Contactos</a>`;

    expect(parseCareersPageJobs(html, 'https://www.aubay.pt/carreira')).toEqual([]);
  });
});

describe('extractJobPageText', () => {
  it('reads the main content without scripts, navigation or footer', () => {
    const html = `<html><head><style>.x{}</style></head><body>
      <nav><a href="/">Home</a><a href="/jobs">Jobs</a></nav>
      <main><h1>Backend Developer (Golang)</h1><p>Lisbon, Portugal</p>
        <ul><li>Node</li><li>SQL</li></ul><script>track()</script></main>
      <footer>© KWAN</footer></body></html>`;

    expect(extractJobPageText(html)).toBe('Backend Developer (Golang) Lisbon, Portugal Node SQL');
  });

  it('falls back to the body when the page has no main or article', () => {
    const html = '<body><header>Menu</header><div class="job"><h2>.Net Developer</h2>Full Time</div></body>';

    expect(extractJobPageText(html)).toBe('.Net Developer Full Time');
  });
});

describe('scanAllPortals with careers pages', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    db.portalSeenJob.findMany.mockResolvedValue([]);
    db.portalSeenJob.createMany.mockResolvedValue({ count: 0 });
    db.companyPortal.update.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('leaves manual portals out of the scan', async () => {
    db.companyPortal.findMany.mockResolvedValue([]);

    await scanAllPortals();

    expect(db.companyPortal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, portalType: { not: 'manual' } } })
    );
  });

  it('reads a custom careers page and applies the title filters', async () => {
    db.companyPortal.findMany.mockResolvedValue([
      {
        id: 'p1',
        company: 'Growin',
        careersUrl: 'https://www.growin.com/join-the-team-growin-careers/',
        portalType: 'custom',
        portalSlug: null,
        titleFilters: JSON.stringify({ include: ['node'], exclude: ['lead'] }),
      },
    ]);
    fetchMock.mockResolvedValue({
      ok: true,
      url: 'https://www.growin.com/join-the-team-growin-careers/',
      text: async () => `
        <a href="/job-apply/96d7d088d6/backend-developer-nodejs"><h2>Backend Developer - NodeJS</h2></a>
        <a href="/job-apply/78e62e1e9b/backend-developer-java"><h2>Backend Developer - Java</h2></a>
        <a href="/job-apply/11aa22bb33/nodejs-tech-lead"><h2>NodeJS Tech Lead</h2></a>`,
    });

    const [result] = await scanAllPortals();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.growin.com/join-the-team-growin-careers/',
      expect.any(Object)
    );
    expect(result.errors).toEqual([]);
    expect(result.newJobs.map((j) => j.title)).toEqual(['Backend Developer - NodeJS']);
    expect(result.newJobs[0]).toMatchObject({
      source: 'ats',
      company: 'Growin',
      url: 'https://www.growin.com/job-apply/96d7d088d6/backend-developer-nodejs',
    });
    expect(db.portalSeenJob.createMany).toHaveBeenCalledWith({
      data: [
        {
          portalId: 'p1',
          url: 'https://www.growin.com/job-apply/96d7d088d6/backend-developer-nodejs',
          title: 'Backend Developer - NodeJS',
        },
      ],
      skipDuplicates: true,
    });
  });

  it('returns every filtered job for the feed and only the unseen ones as new', async () => {
    db.companyPortal.findMany.mockResolvedValue([
      {
        id: 'p3',
        company: 'Fyld',
        careersUrl: 'https://www.fyld.pt/it-jobs/',
        portalType: 'custom',
        portalSlug: null,
        titleFilters: null,
      },
    ]);
    fetchMock.mockResolvedValue({
      ok: true,
      url: 'https://www.fyld.pt/it-jobs/',
      text: async () => `
        <a href="/job-apply/aa/fullstack-node"><h2>Fullstack Node.js Developer</h2></a>
        <a href="/job-apply/bb/java-developer"><h2>Java Developer</h2></a>`,
    });
    db.portalSeenJob.findMany.mockResolvedValue([{ url: 'https://www.fyld.pt/job-apply/aa/fullstack-node' }]);

    const [result] = await scanAllPortals();

    expect(result.jobs.map((j) => j.title)).toEqual(['Fullstack Node.js Developer', 'Java Developer']);
    expect(result.newJobs.map((j) => j.title)).toEqual(['Java Developer']);
  });

  it('reports a careers page without job links as an error, not as zero jobs', async () => {
    db.companyPortal.findMany.mockResolvedValue([
      {
        id: 'p2',
        company: 'Aubay',
        careersUrl: 'https://www.aubay.pt/carreira',
        portalType: 'custom',
        portalSlug: null,
        titleFilters: null,
      },
    ]);
    fetchMock.mockResolvedValue({ ok: true, url: 'https://www.aubay.pt/carreira', text: async () => '<div id="app"></div>' });

    const [result] = await scanAllPortals();

    expect(result.newJobs).toEqual([]);
    expect(result.errors[0]).toContain('"manual"');
  });
});

describe('seedConsultancyPortals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.companyPortal.createMany.mockResolvedValue({ count: 0 });
  });

  it('adds only the consultancies that are not tracked yet', async () => {
    db.companyPortal.findMany.mockResolvedValue([{ company: 'kwan' }, { company: 'Aubay' }]);

    const created = await seedConsultancyPortals();

    expect(created).toHaveLength(CONSULTANCY_PORTALS.length - 2);
    expect(created).not.toContain('KWAN');
    expect(created).not.toContain('Aubay');
    const { data } = db.companyPortal.createMany.mock.calls[0][0];
    expect(data.find((p: { company: string }) => p.company === 'Growin')).toMatchObject({
      portalType: 'custom',
      careersUrl: 'https://www.growin.com/join-the-team-growin-careers/',
    });
    expect(JSON.parse(data[0].titleFilters).include).toContain('node');
  });

  it('does nothing when every consultancy is already tracked', async () => {
    db.companyPortal.findMany.mockResolvedValue(CONSULTANCY_PORTALS.map((p) => ({ company: p.company })));

    expect(await seedConsultancyPortals()).toEqual([]);
    expect(db.companyPortal.createMany).not.toHaveBeenCalled();
  });
});
