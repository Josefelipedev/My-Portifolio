// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock('node:dns/promises', () => dns);

import { BlockedUrlError, fetchPublicUrl } from '../../../apps/api/src/lib/safe-fetch';

const PUBLIC_ADDRESS = [{ address: '104.18.12.34', family: 4 }];

function redirectTo(location: string) {
  return new Response(null, { status: 302, headers: { location } });
}

describe('fetchPublicUrl', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    dns.lookup.mockResolvedValue(PUBLIC_ADDRESS);
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches a public page without letting fetch follow redirects on its own', async () => {
    const res = await fetchPublicUrl('https://jobs.example.com/backend', { headers: { a: 'b' } });

    expect(await res.text()).toBe('ok');
    expect(fetchMock).toHaveBeenCalledWith('https://jobs.example.com/backend', {
      headers: { a: 'b' },
      redirect: 'manual',
    });
  });

  it.each([
    'http://127.0.0.1:11434/api/tags',
    'http://localhost.example:8001/logs',
    'http://10.66.66.3:8085/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]:4000/health',
    'http://[::ffff:127.0.0.1]/',
    'http://2130706433/',
  ])('refuses %s', async (url) => {
    if (url.includes('localhost.example')) dns.lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);

    await expect(fetchPublicUrl(url)).rejects.toThrow(BlockedUrlError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a name when any of its addresses is internal', async () => {
    dns.lookup.mockResolvedValue([PUBLIC_ADDRESS[0], { address: 'fd00::5', family: 6 }]);

    await expect(fetchPublicUrl('https://mixed.example.com/')).rejects.toThrow(BlockedUrlError);
  });

  it('refuses schemes other than http(s)', async () => {
    await expect(fetchPublicUrl('file:///etc/passwd')).rejects.toThrow(BlockedUrlError);
    await expect(fetchPublicUrl('ftp://example.com/x')).rejects.toThrow(BlockedUrlError);
  });

  it('follows a redirect to another public page, checking it first', async () => {
    fetchMock.mockResolvedValueOnce(redirectTo('/jobs/42')).mockResolvedValueOnce(new Response('job', { status: 200 }));

    const res = await fetchPublicUrl('https://careers.example.com/open');

    expect(await res.text()).toBe('job');
    expect(fetchMock).toHaveBeenLastCalledWith('https://careers.example.com/jobs/42', { redirect: 'manual' });
    expect(dns.lookup).toHaveBeenCalledTimes(2);
  });

  it('stops at a redirect that points inside the server', async () => {
    fetchMock.mockResolvedValueOnce(redirectTo('http://127.0.0.1:8001/jobs/search/x'));

    await expect(fetchPublicUrl('https://careers.example.com/open')).rejects.toThrow(BlockedUrlError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after five redirects', async () => {
    fetchMock.mockImplementation(async () => redirectTo('https://loop.example.com/again'));

    await expect(fetchPublicUrl('https://loop.example.com/start')).rejects.toThrow('Too many redirects');
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});
