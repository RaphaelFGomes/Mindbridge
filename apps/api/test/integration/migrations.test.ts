import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../../src/db/migrate.js';
import { createTestContext, memoryInput, type TestContext } from './helpers.js';

describe('database migrations', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    await ctx.reset();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('can be re-applied safely: a second run is a no-op that keeps existing data', async () => {
    // Global setup already migrated this database; deploys run migrate on every release.
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/v1/memories',
      payload: memoryInput(),
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json<{ id: string }>();

    await expect(runMigrations(ctx.db)).resolves.toBeUndefined();

    const after = await ctx.app.inject({ method: 'GET', url: `/v1/memories/${id}` });
    expect(after.statusCode).toBe(200);
  });
});
