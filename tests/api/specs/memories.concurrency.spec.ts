import { randomUUID } from 'node:crypto';
import { expect, test } from '../fixtures.js';

test.describe('Concurrency', () => {
  test('parallel creates with the same name yield exactly one memory', async ({
    memories,
    memory,
    project,
  }) => {
    const input = memory();

    const statuses = await Promise.all(
      Array.from({ length: 8 }, async () => (await memories.create(input)).status()),
    );

    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(7);
    expect((await memories.listOk({ project, includeGlobal: false })).total).toBe(1);
  });

  test('parallel renames onto the same name let exactly one win', async ({ memories, memory }) => {
    const target = `target-${randomUUID()}`;
    const created = await Promise.all(Array.from({ length: 4 }, () => memories.createOk(memory())));

    const statuses = await Promise.all(
      created.map(async ({ id }) => (await memories.update(id, { name: target })).status()),
    );

    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(3);
  });
});
