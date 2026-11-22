import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  memoryListSchema,
  memorySchema,
  type Memory,
} from '../../src/modules/memories/memory.schemas.js';
import { createTestContext, memoryInput, type TestContext } from './helpers.js';

const WIDGETS = 'github.com/acme/widgets';
const GADGETS = 'github.com/acme/gadgets';

describe('Memories API', () => {
  let ctx: TestContext;

  const create = (payload: unknown) =>
    ctx.app.inject({ method: 'POST', url: '/v1/memories', payload: payload as object });

  const createOk = async (payload: object): Promise<Memory> => {
    const response = await create(payload);
    expect(response.statusCode).toBe(201);
    return memorySchema.parse(response.json());
  };

  const list = async (query = '') => {
    const response = await ctx.app.inject({ method: 'GET', url: `/v1/memories${query}` });
    expect(response.statusCode).toBe(200);
    return memoryListSchema.parse(response.json());
  };

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  describe('POST /v1/memories', () => {
    it('creates a project memory and points Location at it', async () => {
      const response = await create(memoryInput());

      expect(response.statusCode).toBe(201);
      const memory = memorySchema.parse(response.json());
      expect(memory).toMatchObject(memoryInput());
      expect(memory.createdAt).toBe(memory.updatedAt);
      expect(response.headers.location).toBe(`/v1/memories/${memory.id}`);
    });

    it('creates a global memory when project is omitted', async () => {
      const { project: _omitted, ...input } = memoryInput({ type: 'user' });
      const memory = await createOk(input);
      expect(memory.project).toBeNull();
    });

    it('trims description and content', async () => {
      const memory = await createOk(
        memoryInput({ description: '  Use pnpm  ', content: '\n pnpm only \n' }),
      );
      expect(memory).toMatchObject({ description: 'Use pnpm', content: 'pnpm only' });
    });

    it.each([
      ['type is missing', { type: undefined }, 'body.type'],
      ['type is unknown', { type: 'secret' }, 'body.type'],
      ['name is not kebab-case', { name: 'Prefers PNPM' }, 'body.name'],
      ['description is blank', { description: '   ' }, 'body.description'],
      ['content is too long', { content: 'x'.repeat(10_001) }, 'body.content'],
      ['project is a raw URL', { project: 'https://github.com/Acme/Widgets.git' }, 'body.project'],
    ])('returns 400 when %s', async (_case, override, path) => {
      const response = await create({ ...memoryInput(), ...override });

      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(response.json()).toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
        errors: expect.arrayContaining([expect.objectContaining({ path })]) as unknown,
      });
    });

    it('returns 400 for unknown fields', async () => {
      const response = await create({ ...memoryInput(), embedding: [0.1, 0.2] });
      expect(response.statusCode).toBe(400);
    });

    it('returns 409 when the name already exists in the same project', async () => {
      await createOk(memoryInput());
      const response = await create(memoryInput({ content: 'A different fact' }));

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ status: 409, code: 'CONFLICT' });
    });

    it('returns 409 when a global name is reused globally', async () => {
      await createOk(memoryInput({ project: null }));
      const response = await create(memoryInput({ project: null }));
      expect(response.statusCode).toBe(409);
    });

    it('allows the same name in different scopes', async () => {
      await createOk(memoryInput({ project: WIDGETS }));
      await createOk(memoryInput({ project: GADGETS }));
      await createOk(memoryInput({ project: null }));

      expect((await list()).total).toBe(3);
    });
  });

  describe('GET /v1/memories/:id', () => {
    it('returns the memory', async () => {
      const created = await createOk(memoryInput());
      const response = await ctx.app.inject({ method: 'GET', url: `/v1/memories/${created.id}` });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(created);
    });

    it('returns 404 for an unknown id', async () => {
      const response = await ctx.app.inject({ method: 'GET', url: `/v1/memories/${randomUUID()}` });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('GET /v1/memories', () => {
    beforeEach(async () => {
      await createOk(memoryInput({ project: null, type: 'user', name: 'prefers-concise-answers' }));
      await createOk(memoryInput({ project: WIDGETS, type: 'feedback', name: 'uses-pnpm' }));
      await createOk(memoryInput({ project: WIDGETS, type: 'project', name: 'deploy-freeze' }));
      await createOk(memoryInput({ project: GADGETS, type: 'feedback', name: 'uses-npm' }));
    });

    const names = (items: Memory[]) => items.map((memory) => memory.name);

    it('lists every memory ordered by name when unfiltered', async () => {
      const result = await list();
      expect(result).toMatchObject({ total: 4, limit: 20, offset: 0 });
      expect(names(result.items)).toEqual([
        'deploy-freeze',
        'prefers-concise-answers',
        'uses-npm',
        'uses-pnpm',
      ]);
    });

    it('includes global memories when filtering by project', async () => {
      const result = await list(`?project=${WIDGETS}`);
      expect(names(result.items)).toEqual([
        'deploy-freeze',
        'prefers-concise-answers',
        'uses-pnpm',
      ]);
    });

    it('excludes global memories when includeGlobal=false', async () => {
      const result = await list(`?project=${WIDGETS}&includeGlobal=false`);
      expect(names(result.items)).toEqual(['deploy-freeze', 'uses-pnpm']);
    });

    it('filters by type', async () => {
      const result = await list(`?project=${WIDGETS}&type=feedback`);
      expect(names(result.items)).toEqual(['uses-pnpm']);
    });

    it('paginates without overlap and reports the full total', async () => {
      const first = await list('?limit=2&offset=0');
      const second = await list('?limit=2&offset=2');
      const beyond = await list('?limit=2&offset=4');

      expect(first.total).toBe(4);
      expect(second.total).toBe(4);
      expect([...names(first.items), ...names(second.items)]).toEqual(names((await list()).items));
      expect(beyond.items).toEqual([]);
    });

    it.each(['?limit=0', '?limit=101', '?offset=-1', '?type=secret', '?includeGlobal=maybe'])(
      'returns 400 for %s',
      async (query) => {
        const response = await ctx.app.inject({ method: 'GET', url: `/v1/memories${query}` });
        expect(response.statusCode).toBe(400);
      },
    );
  });

  describe('PATCH /v1/memories/:id', () => {
    const patch = (id: string, payload: object) =>
      ctx.app.inject({ method: 'PATCH', url: `/v1/memories/${id}`, payload });

    it('updates the given fields and bumps updatedAt', async () => {
      const created = await createOk(memoryInput());
      await sleep(5);

      const response = await patch(created.id, { content: 'Use pnpm 12 or newer.' });

      expect(response.statusCode).toBe(200);
      const updated = memorySchema.parse(response.json());
      expect({ ...updated, updatedAt: created.updatedAt }).toEqual({
        ...created,
        content: 'Use pnpm 12 or newer.',
      });
      expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(created.updatedAt));
    });

    it('returns 409 when renaming onto an existing name in the same scope', async () => {
      await createOk(memoryInput({ name: 'taken' }));
      const other = await createOk(memoryInput({ name: 'free' }));

      const response = await patch(other.id, { name: 'taken' });
      expect(response.statusCode).toBe(409);
    });

    it('returns 400 for an empty patch', async () => {
      const created = await createOk(memoryInput());
      const response = await patch(created.id, {});
      expect(response.statusCode).toBe(400);
    });

    it('returns 404 for an unknown id', async () => {
      const response = await patch(randomUUID(), { content: 'x' });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /v1/memories/:id', () => {
    it('deletes the memory', async () => {
      const created = await createOk(memoryInput());

      const response = await ctx.app.inject({
        method: 'DELETE',
        url: `/v1/memories/${created.id}`,
      });
      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');

      const after = await ctx.app.inject({ method: 'GET', url: `/v1/memories/${created.id}` });
      expect(after.statusCode).toBe(404);
    });

    it('returns 404 for an unknown id', async () => {
      const response = await ctx.app.inject({
        method: 'DELETE',
        url: `/v1/memories/${randomUUID()}`,
      });
      expect(response.statusCode).toBe(404);
    });
  });
});
