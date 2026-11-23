import { expect, test } from '../fixtures.js';
import type { Memory } from '../support/memories-client.js';

test('a memory can be created, found, updated and deleted', async ({
  memories,
  memory,
  project,
  request,
}) => {
  const input = memory({ type: 'project', content: 'Deploy freeze until the 2nd.' });
  let created!: Memory;

  await test.step('create it', async () => {
    const response = await memories.create(input);
    expect(response.status()).toBe(201);
    created = (await response.json()) as Memory;
    expect(created).toMatchObject({ ...input });

    // Location points at the new resource.
    const location = response.headers().location ?? '';
    expect(location).toBe(`/v1/memories/${created.id}`);
    expect((await request.get(location)).status()).toBe(200);
  });

  await test.step('read it back by id', async () => {
    const response = await memories.get(created.id);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual(created);
  });

  await test.step('find it in its project', async () => {
    const list = await memories.listOk({ project, includeGlobal: false });
    expect(list.items).toEqual([created]);
    expect(list.total).toBe(1);
  });

  await test.step('update its content', async () => {
    const response = await memories.update(created.id, { content: 'Deploy freeze lifted.' });
    expect(response.status()).toBe(200);
    const updated = (await response.json()) as Memory;
    expect(updated).toMatchObject({ id: created.id, content: 'Deploy freeze lifted.' });
    expect(updated.createdAt).toBe(created.createdAt);
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(Date.parse(created.updatedAt));
  });

  await test.step('delete it', async () => {
    expect((await memories.remove(created.id)).status()).toBe(204);
    expect((await memories.get(created.id)).status()).toBe(404);
    expect((await memories.listOk({ project, includeGlobal: false })).total).toBe(0);
  });
});
