// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // Sources keep module-level caches; start every test from a clean module.
  vi.resetModules();
});

const jobicy = () => import('../../../apps/api/src/lib/jobs/apis/jobicy');
const buscojobs = () => import('../../../apps/api/src/lib/jobs/apis/buscojobs');
const aggregator = () => import('../../../apps/api/src/lib/jobs/aggregator');

function wafResponse() {
  return new Response('<title>Human Verification</title>', {
    status: 405,
    headers: { 'x-amzn-waf-action': 'captcha' },
  });
}

function buscoPage(offers: object[]) {
  const data = JSON.stringify({ props: { pageProps: { resultadosIniciales: { ofertas: offers } } } });
  return new Response(`<script id="__NEXT_DATA__" type="application/json">${data}</script>`);
}

describe('Jobicy', () => {
  it('searches by tag inside the dev industry', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ jobs: [] }));
    await (await jobicy()).searchJobicy({ keyword: 'backend developer' });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('tag')).toBe('backend developer');
    expect(url.searchParams.get('industry')).toBe('dev');
    expect(url.searchParams.has('search')).toBe(false);
  });

  it('rejects on an API error instead of returning no jobs', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 400 }));
    await expect((await jobicy()).searchJobicy({ keyword: 'x' })).rejects.toThrow('Jobicy API error: 400');
  });
});

describe('BuscoJobs', () => {
  it('reports an AWS WAF captcha as a block and stops after the first page', async () => {
    fetchMock.mockResolvedValue(wafResponse());
    const { searchBuscoJobs } = await buscojobs();

    await expect(searchBuscoJobs({ keyword: 'backend' })).rejects.toThrow('blocked by AWS WAF captcha');
    await expect(searchBuscoJobs({ keyword: 'node' })).rejects.toThrow('blocked by AWS WAF captcha');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches the category pages once and filters each keyword locally', async () => {
    fetchMock.mockImplementation(async () =>
      buscoPage([
        { IdOferta: 1, CargoVacante: 'Backend Developer Node.js' },
        { IdOferta: 2, CargoVacante: 'Técnico de Redes' },
      ])
    );
    const { searchBuscoJobs } = await buscojobs();

    const backend = await searchBuscoJobs({ keyword: 'backend' });
    const redes = await searchBuscoJobs({ keyword: 'tecnico' });

    expect(backend.map((j) => j.id)).toEqual(['buscojobs-1']);
    expect(redes.map((j) => j.id)).toEqual(['buscojobs-2']);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});

describe('searchJobs source errors', () => {
  it('records a failing source', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 400 }));
    const { searchJobs, getLastSourceErrors } = await aggregator();

    const jobs = await searchJobs({ keyword: 'backend', country: 'remote' }, 'jobicy');

    expect(jobs).toEqual([]);
    expect(getLastSourceErrors()).toEqual([{ source: 'Jobicy', error: 'Jobicy API error: 400' }]);
  });
});
