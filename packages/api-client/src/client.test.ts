import { describe, expect, it } from 'vitest';
import { createApiClient, MindbridgeApiError, type Memory } from './index.js';

const KEY = `mb_${'k'.repeat(43)}`;

const memory = (id: string): Memory => ({
  id,
  project: 'github.com/acme/widgets',
  type: 'feedback',
  name: `memory-${id}`,
  description: 'Use pnpm, never npm',
  content: 'The widgets team standardized on pnpm workspaces.',
  createdAt: '2026-11-26T10:00:00.000Z',
  updatedAt: '2026-11-26T10:00:00.000Z',
});

const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });

/** Answers with queued responses and records the requests. */
function fakeFetch(...responses: (Response | Error)[]) {
  const requests: Request[] = [];
  const fetch = (request: Request) => {
    requests.push(request);
    const next = responses.shift();
    if (next === undefined) return Promise.reject(new Error('unexpected request'));
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  };
  return { fetch, requests };
}

const client = (fake: ReturnType<typeof fakeFetch>) =>
  createApiClient({ baseUrl: 'http://api.test', apiKey: KEY, fetch: fake.fetch });

describe('createApiClient', () => {
  it('sends the API key as a bearer token', async () => {
    const fake = fakeFetch(json(200, memory('a')));
    await client(fake).get('a');
    expect(fake.requests[0]?.headers.get('authorization')).toBe(`Bearer ${KEY}`);
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/v1/memories/a');
  });

  it('returns one page with its total', async () => {
    const fake = fakeFetch(json(200, { items: [memory('a')], total: 42, limit: 10, offset: 20 }));

    const page = await client(fake).list({
      project: 'github.com/acme/widgets',
      limit: 10,
      offset: 20,
    });

    expect(page.total).toBe(42);
    expect(Object.fromEntries(new URL(fake.requests[0]?.url ?? '').searchParams)).toEqual({
      project: 'github.com/acme/widgets',
      limit: '10',
      offset: '20',
    });
  });

  it('follows pagination to the end with listAll', async () => {
    const first = Array.from({ length: 100 }, (_, i) => memory(`m${i}`));
    const fake = fakeFetch(
      json(200, { items: first, total: 101, limit: 100, offset: 0 }),
      json(200, { items: [memory('m100')], total: 101, limit: 100, offset: 100 }),
    );

    const all = await client(fake).listAll({});

    expect(all).toHaveLength(101);
    expect(fake.requests.map((r) => new URL(r.url).searchParams.get('offset'))).toEqual([
      '0',
      '100',
    ]);
  });

  it('creates, updates and deletes', async () => {
    const fake = fakeFetch(
      json(201, memory('a')),
      json(200, memory('a')),
      new Response(null, { status: 204 }),
    );
    const api = client(fake);

    await api.create({ type: 'user', name: 'x', description: 'd', content: 'c' });
    await api.update('a', { content: 'new' });
    await api.remove('a');

    expect(fake.requests.map((r) => r.method)).toEqual(['POST', 'PATCH', 'DELETE']);
    expect(await fake.requests[1]?.json()).toEqual({ content: 'new' });
  });
});

describe('errors', () => {
  const failing = async (response: Response | Error) => {
    try {
      await client(fakeFetch(response)).get('a');
    } catch (error) {
      return error as MindbridgeApiError;
    }
    throw new Error('expected the call to fail');
  };

  it('carries status, code, detail and field errors from problem details', async () => {
    const error = await failing(
      json(
        400,
        {
          status: 400,
          code: 'VALIDATION_ERROR',
          detail: 'The request is invalid.',
          errors: [{ path: 'params.id', message: 'Invalid UUID' }],
        },
        'application/problem+json',
      ),
    );

    expect(error).toBeInstanceOf(MindbridgeApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'The request is invalid.',
      fieldErrors: [{ path: 'params.id', message: 'Invalid UUID' }],
    });
  });

  it('falls back to the HTTP status for non-problem bodies, e.g. a proxy page', async () => {
    const error = await failing(
      new Response('<html>Bad Gateway</html>', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'content-type': 'text/html' },
      }),
    );
    expect(error).toMatchObject({ status: 502, code: 'HTTP_502', message: 'Bad Gateway' });
  });

  it('reports an unreachable API with its URL', async () => {
    const error = await failing(new TypeError('fetch failed'));
    expect(error).toMatchObject({ status: null, code: 'API_UNREACHABLE' });
    expect(error.message).toContain('http://api.test');
  });
});
