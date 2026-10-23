import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api-fetch';

describe('apiFetch', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('performs read-only requests without a CSRF round-trip', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}'));
    await apiFetch('/api/jobs/saved');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/jobs/saved', expect.objectContaining({ credentials: 'include' }));
  });

  it('automatically attaches a CSRF token to mutations', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'token-123' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 201 }));

    await apiFetch('/api/jobs/saved/j1/application-packages', { method: 'POST' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/csrf');
    const mutationOptions = fetchMock.mock.calls[1][1] as RequestInit;
    expect(new Headers(mutationOptions.headers).get('x-csrf-token')).toBe('token-123');
  });
});
