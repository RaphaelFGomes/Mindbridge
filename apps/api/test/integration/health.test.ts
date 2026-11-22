import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createDatabase } from '../../src/db/client.js';
import { createTestContext, type TestContext } from './helpers.js';

describe('GET /health', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('reports ok when the database is reachable', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', checks: { database: 'up' } });
  });

  it('reports 503 degraded when the database is unreachable', async () => {
    // A real, refused connection: no mocks.
    const unreachable = createDatabase('postgres://nobody:nothing@127.0.0.1:1/none', {
      connectTimeout: 1,
    });
    const app = await buildApp({ db: unreachable.db });
    try {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ status: 'degraded', checks: { database: 'down' } });
    } finally {
      await app.close();
      await unreachable.close();
    }
  });
});
