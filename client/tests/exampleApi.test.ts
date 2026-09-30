import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchExample } from '../src/lib/api/exampleApi';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({
      'content-type': 'application/json',
    }),
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn(),
  } as unknown as Response;
}

describe('fetchExample', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests and returns the example API response', async () => {
    const response = {
      name: 'Django + React',
      title: 'This is the starter project',
    };
    const controller = new AbortController();
    fetchMock.mockResolvedValue(jsonResponse(response));

    await expect(fetchExample(controller.signal)).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [path, options] = fetchMock.mock.calls[0];
    const headers = new Headers(options?.headers);

    expect(path).toBe('/api/v1/example/');
    expect(options).toMatchObject({
      method: 'GET',
      credentials: 'same-origin',
      signal: controller.signal,
    });
    expect(headers.get('Accept')).toBe('application/json');
  });

  it('exposes API error details to the caller', async () => {
    fetchMock.mockResolvedValue(jsonResponse(
      { detail: 'Service unavailable' },
      503,
    ));

    await expect(fetchExample()).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Service unavailable',
      status: 503,
      details: { detail: 'Service unavailable' },
    });
  });
});
