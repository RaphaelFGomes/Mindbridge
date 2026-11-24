import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { InjectOptions } from 'fastify';
import { inject } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createDatabase } from '../../src/db/client.js';
import { ApiKeyRepository } from '../../src/modules/api-keys/api-key.repository.js';
import type { CreateMemoryBody } from '../../src/modules/memories/memory.schemas.js';

export async function createTestContext() {
  const { db, close } = createDatabase(inject('databaseUrl'), { max: 2 });
  const app = await buildApp({ db });
  await app.ready();

  const keys = new ApiKeyRepository(db);
  const { key: apiKey } = await keys.create(`integration-${randomUUID()}`);

  return {
    app,
    db,
    keys,
    apiKey,
    /** `app.inject` with this context's API key. */
    inject: (options: InjectOptions) =>
      app.inject({
        ...options,
        headers: { authorization: `Bearer ${apiKey}`, ...options.headers },
      }),
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
