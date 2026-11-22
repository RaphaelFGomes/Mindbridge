import { sql } from 'drizzle-orm';
import { inject } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createDatabase } from '../../src/db/client.js';
import type { CreateMemoryBody } from '../../src/modules/memories/memory.schemas.js';

export async function createTestContext() {
  const { db, close } = createDatabase(inject('databaseUrl'), { max: 2 });
  const app = await buildApp({ db });
  await app.ready();

  return {
    app,
    db,
    reset: async () => {
      await db.execute(sql`truncate table memories`);
    },
    close: async () => {
      await app.close();
      await close();
    },
  };
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>;

/** Fictional fixture data only. */
export function memoryInput(overrides: Partial<CreateMemoryBody> = {}): CreateMemoryBody {
  return {
    project: 'github.com/acme/widgets',
    type: 'feedback',
    name: 'prefers-pnpm',
    description: 'Use pnpm, never npm',
    content: 'The widgets team standardized on pnpm workspaces.',
    ...overrides,
  };
}
