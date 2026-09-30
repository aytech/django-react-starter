import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  getJson,
  requestJson,
} from '../src/lib/api/httpClient';

const fetchMock = vi.fn<typeof fetch>();

interface ResponseOptions {
  body?: unknown;
  status?: number;
  contentType?: string | null;
}

function response({
  body = null,
  status = 200,
  contentType = 'application/json',
}: ResponseOptions = {}): Response {
  const headers = new Headers();

  if (contentType !== null) {
    headers.set('content-type', contentType);
  }

  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(
      typeof body === 'string' ? body : JSON.stringify(body),
    ),
  } as unknown as Response;
}

function clearCsrfCookie() {
  document.cookie = 'csrftoken=; Max-Age=0; path=/';
}

describe('httpClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    clearCsrfCookie();
  });

  afterEach(() => {
    clearCsrfCookie();
    vi.unstubAllGlobals();
  });

  it('uses default options for a JSON GET request', async () => {
    const body = { result: 'ok' };
    fetchMock.mockResolvedValue(response({ body }));

    await expect(requestJson<typeof body>('/resource/')).resolves.toEqual(body);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [path, options] = fetchMock.mock.calls[0];
    const headers = new Headers(options?.headers);

    expect(path).toBe('/resource/');
    expect(options).toMatchObject({
      method: 'GET',
      credentials: 'same-origin',
      body: undefined,
    });
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.has('Content-Type')).toBe(false);
    expect(headers.has('X-CSRFToken')).toBe(false);
  });

  it('applies the default getJson options', async () => {
    const body = { result: 'ok' };
    fetchMock.mockResolvedValue(response({ body }));

    await expect(getJson<typeof body>('/resource/')).resolves.toEqual(body);

    expect(fetchMock).toHaveBeenCalledWith(
      '/resource/',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('serializes JSON and adds the CSRF token to unsafe requests', async () => {
    const requestBody = { name: 'Updated' };
    const responseBody = { saved: true };
    document.cookie = 'csrftoken=csrf%20token; path=/';
    fetchMock.mockResolvedValue(response({ body: responseBody }));

    await expect(requestJson<typeof responseBody>('/resource/', {
      method: 'post',
      headers: { 'X-Request-ID': 'request-1' },
      json: requestBody,
    })).resolves.toEqual(responseBody);

    const [, options] = fetchMock.mock.calls[0];
    const headers = new Headers(options?.headers);

    expect(options?.method).toBe('POST');
    expect(options?.body).toBe(JSON.stringify(requestBody));
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-CSRFToken')).toBe('csrf token');
    expect(headers.get('X-Request-ID')).toBe('request-1');
  });

  it('does not add a CSRF header when the cookie is missing', async () => {
    fetchMock.mockResolvedValue(response({ body: { deleted: true } }));

    await requestJson('/resource/', { method: 'DELETE' });

    const [, options] = fetchMock.mock.calls[0];
    const headers = new Headers(options?.headers);

    expect(headers.has('X-CSRFToken')).toBe(false);
  });

  it('returns undefined for a no-content response without parsing it', async () => {
    const noContentResponse = response({ status: 204, contentType: null });
    fetchMock.mockResolvedValue(noContentResponse);

    await expect(requestJson('/resource/')).resolves.toBeUndefined();

    expect(noContentResponse.json).not.toHaveBeenCalled();
    expect(noContentResponse.text).not.toHaveBeenCalled();
  });

  it('rejects a successful response with a non-JSON body', async () => {
    fetchMock.mockResolvedValue(response({
      body: 'plain response',
      contentType: 'text/plain',
    }));

    await expect(requestJson('/resource/')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'API returned an unexpected response format',
      status: 200,
      details: 'plain response',
    });
  });

  it('handles an error response without a content type', async () => {
    fetchMock.mockResolvedValue(response({
      body: 'Server failure',
      status: 500,
      contentType: null,
    }));

    await expect(requestJson('/resource/')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'API request failed with status 500',
      status: 500,
      details: 'Server failure',
    });
  });

  it.each([
    ['null details', null],
    ['an object without detail', {}],
    ['a non-string detail', { detail: 503 }],
  ])('uses the fallback error message for %s', async (_case, details) => {
    fetchMock.mockResolvedValue(response({ body: details, status: 400 }));

    await expect(requestJson('/resource/')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'API request failed with status 400',
      status: 400,
      details,
    });
  });

  it('defaults ApiError details to null', () => {
    const error = new ApiError('Request failed', { status: 400 });

    expect(error).toMatchObject({
      name: 'ApiError',
      message: 'Request failed',
      status: 400,
      details: null,
    });
  });
});
