import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiKeys } from '../../src/db/schema.js';
import { hashApiKey } from '../../src/modules/api-keys/api-key.js';
import { createTestContext, type TestContext } from './helpers.js';

describe('API keys', () => {
  let ctx: TestContext;

  const listWith = (key: string) =>
    ctx.app.inject({
      method: 'GET',
      url: '/v1/memories',
      headers: { authorization: `Bearer ${key}` },
    });

  const newKey = async () => (await ctx.keys.create(`key-${randomUUID()}`)).key;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('accepts a freshly created key', async () => {
    expect((await listWith(await newKey())).statusCode).toBe(200);
  });

  it('rejects a well-formed key that was never issued', async () => {
    const forged = `mb_${'A'.repeat(43)}`;
    const response = await listWith(forged);
    expect(response.statusCode).toBe(401);
    expect(response.headers['www-authenticate']).toBe('Bearer realm="mindbridge"');
  });

  it('stops accepting a key as soon as it is revoked', async () => {
    const name = `revoked-${randomUUID()}`;
    const { key } = await ctx.keys.create(name);
    expect((await listWith(key)).statusCode).toBe(200);

    expect(await ctx.keys.revoke(name)).toBe(true);
    expect((await listWith(key)).statusCode).toBe(401);
  });

  it('stores only a hash and a display prefix, never the key', async () => {
    const { key, info } = await ctx.keys.create(`stored-${randomUUID()}`);

    const [row] = await ctx.db.select().from(apiKeys).where(eq(apiKeys.id, info.id));
    expect(row).toMatchObject({ keyHash: hashApiKey(key), prefix: key.slice(0, 12) });
    expect(Object.values(row ?? {}).map(String)).not.toContain(key);
  });

  it('never exposes hashes when listing keys', async () => {
    const listed = await ctx.keys.list();
    expect(listed.length).toBeGreaterThan(0);
    for (const info of listed) expect(info).not.toHaveProperty('keyHash');
  });

  it('records when a key was last used, at most once a minute', async () => {
    const { key, info } = await ctx.keys.create(`usage-${randomUUID()}`);
    const lastUsed = async () =>
      (await ctx.db.select().from(apiKeys).where(eq(apiKeys.id, info.id)))[0]?.lastUsedAt;

    expect(await lastUsed()).toBeNull();
    await listWith(key);
    const first = await lastUsed();
    expect(first).toBeInstanceOf(Date);

    await sleep(10);
    await listWith(key);
    expect(await lastUsed()).toEqual(first);

    // Once the last use is older than a minute, the next request refreshes it.
    await ctx.db
      .update(apiKeys)
      .set({ lastUsedAt: sql`now() - interval '2 minutes'` })
      .where(eq(apiKeys.id, info.id));
    const stale = await lastUsed();
    await listWith(key);
    expect((await lastUsed())?.getTime()).toBeGreaterThan(stale?.getTime() ?? Infinity);
  });

  it('allows one active key per name, and reusing the name after revoking', async () => {
    const name = `unique-${randomUUID()}`;
    await ctx.keys.create(name);
    await expect(ctx.keys.create(name)).rejects.toThrow();

    await ctx.keys.revoke(name);
    await expect(ctx.keys.create(name)).resolves.toMatchObject({ info: { name } });
  });

  it('reports revoking an unknown or already revoked name', async () => {
    expect(await ctx.keys.revoke(`missing-${randomUUID()}`)).toBe(false);
  });
});
