import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from './app.js';
import { createDatabase } from './db/client.js';

/**
 * HTTP-level unit tests: everything here is answered before any query runs
 * (routing, validation, OpenAPI), so the lazy DB client never connects.
 */
describe('app (no database)', () => {
  const database = createDatabase('postgres://unused:unused@127.0.0.1:1/unused');
  let app: App;

  beforeAll(async () => {
    app = await buildApp({ db: database.db });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it('serves an OpenAPI 3.1 document describing the public routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(response.statusCode).toBe(200);

    const spec = response.json<{ openapi: string; paths: Record<string, object> }>();
    expect(spec.openapi).toBe('3.1.0');
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining(['/health', '/v1/memories', '/v1/memories/{id}']),
    );
    expect(spec.paths).not.toHaveProperty('/openapi.json');
  });

  it('documents every 4xx response with its real media type', async () => {
    const response = await app.inject({ method: 'GET', url: '/openapi.json' });
    interface Operation {
      responses: Record<string, { content?: Record<string, unknown> }>;
    }
    const spec = response.json<{ paths: Record<string, Record<string, Operation>> }>();

    const clientErrors = Object.values(spec.paths)
      .flatMap((operations) => Object.values(operations))
      .flatMap((operation) => Object.entries(operation.responses))
      .filter(([status]) => status.startsWith('4'));

    expect(clientErrors.length).toBeGreaterThan(0);
    for (const [, { content }] of clientErrors) {
      expect(Object.keys(content ?? {})).toEqual(['application/problem+json']);
    }
  });

  it('answers unknown routes with a 404 problem', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({ status: 404, code: 'ROUTE_NOT_FOUND' });
  });

  it.each([
    ['PUT', '/v1/memories', 'GET, POST'],
    ['POST', '/v1/memories/6f1c1f0e-2b8e-4d55-9a5e-0f4f3c2b1a00', 'DELETE, GET, PATCH'],
    ['OPTIONS', '/v1/memories', 'GET, POST'],
    ['HEAD', '/health', 'GET'],
    ['TRACE', '/health', 'GET'],
  ] as const)('answers %s %s with 405 and Allow: %s', async (method, url, allow) => {
    const response = await app.inject({ method, url });
    expect(response.statusCode).toBe(405);
    expect(response.headers.allow).toBe(allow);
    if (method !== 'HEAD') {
      expect(response.json()).toMatchObject({ status: 405, code: 'METHOD_NOT_ALLOWED' });
    }
  });

  it.each([
    ['QUERY without Content-Type', { method: 'QUERY', url: '/health' }],
    [
      'PUT with a malformed JSON body',
      {
        method: 'PUT',
        url: '/v1/memories',
        headers: { 'content-type': 'application/json' },
        payload: '{"name": ',
      },
    ],
  ] as const)('answers 405 before looking at the body (%s)', async (_case, request) => {
    const response = await app.inject(request);
    expect(response.statusCode).toBe(405);
    expect(response.json()).toMatchObject({ code: 'METHOD_NOT_ALLOWED' });
  });

  it('keeps 405 routes out of the OpenAPI document', async () => {
    const response = await app.inject({ method: 'GET', url: '/openapi.json' });
    const spec = response.json<{ paths: Record<string, object> }>();
    expect(Object.keys(spec.paths['/v1/memories'] ?? {}).sort()).toEqual(['get', 'post']);
  });

  it('reports field-level validation errors as a 400 problem', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/memories',
      payload: { type: 'secret', name: 'Not Kebab', description: 'd', content: 'c' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      code: 'VALIDATION_ERROR',
      errors: expect.arrayContaining([
        expect.objectContaining({ path: 'body.type' }),
        expect.objectContaining({ path: 'body.name' }),
      ]) as unknown,
    });
  });

  it('rejects malformed JSON with a 400 problem', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/memories',
      headers: { 'content-type': 'application/json' },
      payload: '{"name": ',
    });
    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
  });

  it('hides database failures behind a generic 500 problem', async () => {
    // The lazy client hits a real refused connection on the first query.
    const response = await app.inject({
      method: 'POST',
      url: '/v1/memories',
      payload: {
        type: 'feedback',
        name: 'prefers-pnpm',
        description: 'Use pnpm',
        content: 'The team uses pnpm.',
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      code: 'INTERNAL_ERROR',
      detail: 'An unexpected error occurred.',
    });
    expect(response.body).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|postgres/i);
  });

  it('rejects a non-UUID id before querying', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/memories/not-a-uuid' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [expect.objectContaining({ path: 'params.id' })] as unknown,
    });
  });
});
