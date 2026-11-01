import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '@/lib/api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('API client', () => {
  it('sends credentialed requests to the versioned API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.get<{ items: unknown[] }>('/monitors');

    expect(result.items).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/v1/monitors');
    expect(options).toMatchObject({ credentials: 'include', method: 'GET' });
    expect((options.headers as Headers).get('Accept')).toBe('application/json');
  });

  it('refreshes once after a 401 and retries the original request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ user: { id: 'u1' } }, 200))
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'm1' }] }, 200));
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.get<{ items: Array<{ id: string }> }>('/monitors');

    expect(result.items[0].id).toBe('m1');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/auth/refresh');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('throws a typed ApiError with server details', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ statusCode: 400, message: ['targetUrl is invalid'] }, 400));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.post('/monitors', {})).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'targetUrl is invalid',
    });
  });

  it('reports a network failure as status zero', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const caught = await api.get('/health').catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(0);
    expect((caught as ApiError).message).toContain('Unable to reach');
  });
});
