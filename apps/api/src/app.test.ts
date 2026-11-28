import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from './app.js';
import { createDatabase } from './db/client.js';
import { generateApiKey } from './modules/api-keys/api-key.js';
import type { ApiKeyStore } from './modules/api-keys/api-key.repository.js';

const VALID_KEY = generateApiKey();
const auth = { authorization: `Bearer ${VALID_KEY}` };

/** In-memory key store: API keys themselves are tested against Postgres in integration. */
const apiKeys: ApiKeyStore = {
  authenticate: (key) =>
    Promise.resolve(key === VALID_KEY ? { id: 'key-id', name: 'unit-tests' } : null),
};

/**
 * HTTP-level unit tests: everything here is answered before a memory query runs
 * (auth, routing, validation, OpenAPI), so the lazy DB client never connects.
 */
describe('app (no database)', () => {
  const database = createDatabase('postgres://unused:unused@127.0.0.1:1/unused');
  let app: App;

  beforeAll(async () => {
    app = await buildApp({ db: database.db, apiKeys });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it('serves exactly the committed OpenAPI document (the contract clients are generated from)', async () => {
    // Regenerate after an intended API change: pnpm --filter @mindbridge/api openapi:export
    const committed: unknown = JSON.parse(
      readFileSync(new URL('../openapi.json', import.meta.url), 'utf8'),
    );
    const response = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(response.json()).toEqual(committed);
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

  describe('security headers', () => {
    it.each([
      ['a public JSON route', { method: 'GET' as const, url: '/openapi.json' }],
      ['a problem response', { method: 'GET' as const, url: '/v1/nope' }],
      ['an unauthenticated /v1 request', { method: 'GET' as const, url: '/v1/memories' }],
    ])('hardens %s', async (_case, request) => {
      const response = await app.inject(request);
      expect(response.headers).toMatchObject({
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'cross-origin-resource-policy': 'same-origin',
        'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
        'cache-control': 'no-store',
      });
    });

    it("keeps a route's own caching, e.g. Swagger UI's static assets", async () => {
      const response = await app.inject({ method: 'GET', url: '/docs/static/swagger-ui.css' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).not.toBe('no-store');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('lets Swagger UI keep its own CSP so /docs still works', async () => {
      const response = await app.inject({ method: 'GET', url: '/docs' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/^text\/html/);
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  it('answers unknown routes with a 404 problem', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({
      status: 404,
      code: 'ROUTE_NOT_FOUND',
      detail: 'Route GET /v1/nope not found.',
    });
  });

  it('does not advertise hidden routes through 405 answers', async () => {
    // /openapi.json is hidden from the document: other methods are simply unknown.
    const response = await app.inject({ method: 'POST', url: '/openapi.json' });
    expect(response.statusCode).toBe(404);
  });

  it('explains a 405 as a problem document', async () => {
    const response = await app.inject({ method: 'PUT', url: '/v1/memories' });
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({
      detail: 'PUT is not supported on /v1/memories. Allowed: GET, POST.',
    });
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
      headers: auth,
      payload: { type: 'secret', name: 'Not Kebab', description: 'd', content: 'c' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      code: 'VALIDATION_ERROR',
      detail: 'The request is invalid.',
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
      headers: { ...auth, 'content-type': 'application/json' },
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
      headers: auth,
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

  describe('API key authentication', () => {
    it.each([
      ['no Authorization header', {}],
      ['a non-Bearer scheme', { authorization: 'Basic dXNlcjpwYXNz' }],
      ['a malformed key', { authorization: 'Bearer not-a-key' }],
      ['an unknown key', { authorization: `Bearer ${generateApiKey()}` }],
    ])('answers 401 with WWW-Authenticate for %s', async (_case, headers) => {
      const response = await app.inject({ method: 'GET', url: '/v1/memories', headers });

      expect(response.statusCode).toBe(401);
      expect(response.headers['www-authenticate']).toBe('Bearer realm="mindbridge"');
      expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(response.json()).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    });

    it('authenticates before validating, so invalid input reveals nothing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/memories',
        payload: { type: 'secret' },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).not.toHaveProperty('errors');
    });

    it('keeps health and docs public', async () => {
      expect((await app.inject({ method: 'GET', url: '/openapi.json' })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/docs' })).statusCode).toBe(200);
    });

    it('documents the bearer scheme, and a 401, on every /v1 operation', async () => {
      const response = await app.inject({ method: 'GET', url: '/openapi.json' });
      interface Operation {
        security?: Record<string, string[]>[];
        responses: Record<string, unknown>;
      }
      const spec = response.json<{
        paths: Record<string, Record<string, Operation>>;
        components: { securitySchemes: Record<string, unknown> };
      }>();

      expect(spec.components.securitySchemes.apiKey).toMatchObject({
        type: 'http',
        scheme: 'bearer',
      });
      for (const [path, operations] of Object.entries(spec.paths)) {
        for (const operation of Object.values(operations)) {
          if (path.startsWith('/v1/')) {
            expect(operation.security).toEqual([{ apiKey: [] }]);
            expect(operation.responses).toHaveProperty('401');
          } else {
            expect(operation.security).toBeUndefined();
          }
        }
      }
    });

    it('fails closed with a 500 when keys cannot be checked', async () => {
      // Default store = real repository on an unreachable database.
      const unchecked = await buildApp({ db: database.db });
      try {
        const response = await unchecked.inject({
          method: 'GET',
          url: '/v1/memories',
          headers: auth,
        });
        expect(response.statusCode).toBe(500);
        expect(response.json()).toMatchObject({ code: 'INTERNAL_ERROR' });
      } finally {
        await unchecked.close();
      }
    });
  });

  it('reports unknown body fields at the body itself', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/memories',
      headers: auth,
      payload: {
        type: 'feedback',
        name: 'prefers-pnpm',
        description: 'Use pnpm',
        content: 'The team uses pnpm.',
        embedding: [0.1],
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      errors: [expect.objectContaining({ path: 'body' })] as unknown,
    });
  });

  it('logs unexpected failures for operators, and only those', async () => {
    const lines: string[] = [];
    const stream = { write: (line: string) => void lines.push(line) };
    const logged = await buildApp({ db: database.db, apiKeys, logger: { level: 'error', stream } });
    try {
      // Client errors are the client's business: no error log.
      await logged.inject({ method: 'GET', url: '/v1/memories/not-a-uuid', headers: auth });
      await logged.inject({ method: 'GET', url: '/v1/nope' });
      expect(lines).toEqual([]);

      // An unexpected failure (unreachable database) is logged once, at error level.
      const response = await logged.inject({
        method: 'POST',
        url: '/v1/memories',
        headers: auth,
        payload: { type: 'user', name: 'tz', description: 'Timezone', content: 'UTC.' },
      });
      expect(response.statusCode).toBe(500);
      const entries = lines.map((line) => JSON.parse(line) as { level: number; err?: object });
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ level: 50, err: expect.any(Object) as object });
    } finally {
      await logged.close();
    }
  });

  it('rejects a non-UUID id before querying', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/memories/not-a-uuid',
      headers: auth,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [expect.objectContaining({ path: 'params.id' })] as unknown,
    });
  });
});
