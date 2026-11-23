import { randomUUID } from 'node:crypto';
import { expect, test } from '../fixtures.js';

test.describe('Client errors', () => {
  const invalidBodies: [string, Record<string, unknown>, string][] = [
    ['type is missing', { type: undefined }, 'body.type'],
    ['type is unknown', { type: 'secret' }, 'body.type'],
    ['name is not kebab-case', { name: 'Prefers PNPM' }, 'body.name'],
    ['description is blank', { description: '   ' }, 'body.description'],
    ['content contains NUL', { content: 'pnpm\u0000only' }, 'body.content'],
    ['content is too long', { content: 'x'.repeat(10_001) }, 'body.content'],
    ['project is a raw git URL', { project: 'git@github.com:acme/widgets.git' }, 'body.project'],
    ['an unknown field is sent', { embedding: [0.1, 0.2] }, 'body'],
  ];

  for (const [scenario, override, path] of invalidBodies) {
    test(`POST /v1/memories returns 400 when ${scenario}`, async ({ memories, memory }) => {
      const response = await memories.create({ ...memory(), ...override });

      expect(response.status()).toBe(400);
      expect(await response.json()).toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
        errors: expect.arrayContaining([expect.objectContaining({ path })]),
      });
    });
  }

  test('POST /v1/memories returns 409 for a duplicate name in the same scope', async ({
    memories,
    memory,
  }) => {
    const input = memory();
    await memories.createOk(input);

    const response = await memories.create({ ...input, content: 'A different fact' });
    expect(response.status()).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'CONFLICT' });
  });

  test('PATCH /v1/memories/:id returns 400 for an empty patch', async ({ memories, memory }) => {
    const created = await memories.createOk(memory());
    expect((await memories.update(created.id, {})).status()).toBe(400);
  });

  test('unknown ids return 404 on read, update and delete', async ({ memories }) => {
    const id = randomUUID();
    expect((await memories.get(id)).status()).toBe(404);
    expect((await memories.update(id, { content: 'x' })).status()).toBe(404);
    expect((await memories.remove(id)).status()).toBe(404);
  });

  test('a malformed id returns 400 instead of reaching the database', async ({ memories }) => {
    const response = await memories.get('not-a-uuid');
    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({
      errors: [expect.objectContaining({ path: 'params.id' })] as unknown,
    });
  });

  test('undeclared methods return 405 with an Allow header', async ({ request }) => {
    const response = await request.put('/v1/memories', { data: {} });
    expect(response.status()).toBe(405);
    expect(response.headers().allow).toBe('GET, POST');
    expect(response.headers()['content-type']).toContain('application/problem+json');
  });

  test('unknown routes return a 404 problem', async ({ request }) => {
    const response = await request.get('/v1/nope');
    expect(response.status()).toBe(404);
    expect(await response.json()).toMatchObject({ status: 404, code: 'ROUTE_NOT_FOUND' });
  });
});
