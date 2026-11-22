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

  it('answers unknown routes with a 404 problem', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({ status: 404, code: 'ROUTE_NOT_FOUND' });
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

  it('rejects a non-UUID id before querying', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/memories/not-a-uuid' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [expect.objectContaining({ path: 'params.id' })] as unknown,
    });
  });
});
