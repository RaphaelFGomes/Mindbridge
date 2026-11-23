import { randomUUID } from 'node:crypto';
import { expect, test } from '../fixtures.js';

const names = (items: { name: string }[]) => items.map((item) => item.name);

test.describe('Memory scoping', () => {
  test('project memories do not leak into other projects', async ({
    memories,
    memory,
    project,
  }) => {
    const other = `github.com/api-tests/${randomUUID()}`;
    const mine = await memories.createOk(memory());
    await memories.createOk(memory({ project: other }));

    const list = await memories.listOk({ project, includeGlobal: false });
    expect(names(list.items)).toEqual([mine.name]);
  });

  test('global memories are visible from every project unless excluded', async ({
    memories,
    memory,
    project,
  }) => {
    const global = await memories.createOk(memory({ project: null, type: 'user' }));

    // Other tests create global memories concurrently, so search every page.
    expect(names(await memories.listAll({ project }))).toContain(global.name);
    expect(names(await memories.listAll({ project, includeGlobal: false }))).not.toContain(
      global.name,
    );
  });

  test('the same name can be reused in another scope', async ({ memories, memory }) => {
    const name = `shared-${randomUUID()}`;
    await memories.createOk(memory({ name }));
    await memories.createOk(memory({ name, project: `github.com/api-tests/${randomUUID()}` }));
    await memories.createOk(memory({ name, project: null }));
  });

  test('lists can be filtered by type', async ({ memories, memory, project }) => {
    const feedback = await memories.createOk(memory({ type: 'feedback' }));
    await memories.createOk(memory({ type: 'reference' }));

    const list = await memories.listOk({ project, includeGlobal: false, type: 'feedback' });
    expect(names(list.items)).toEqual([feedback.name]);
  });

  test('pagination is stable, ordered by name and reports the full total', async ({
    memories,
    memory,
    project,
  }) => {
    const created = await Promise.all(
      ['e', 'b', 'd', 'a', 'c'].map((letter) =>
        memories.createOk(memory({ name: `${letter}-${randomUUID()}` })),
      ),
    );
    const expected = names(created).sort();
    const page = (offset: number) =>
      memories.listOk({ project, includeGlobal: false, limit: 2, offset });

    const pages = await Promise.all([page(0), page(2), page(4), page(6)]);

    expect(pages.map((p) => p.total)).toEqual([5, 5, 5, 5]);
    expect(pages.map((p) => p.items.length)).toEqual([2, 2, 1, 0]);
    expect(pages.flatMap((p) => names(p.items))).toEqual(expected);
  });
});
