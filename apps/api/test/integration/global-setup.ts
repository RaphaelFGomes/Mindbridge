import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import { createDatabase } from '../../src/db/client.js';
import { runMigrations } from '../../src/db/migrate.js';

/** Same image as docker-compose.yml, so tests run against what developers run. */
const POSTGRES_IMAGE = 'pgvector/pgvector:pg18';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const databaseUrl = container.getConnectionUri();

  // Applying the real migrations is itself part of the test.
  const { db, close } = createDatabase(databaseUrl, { max: 1 });
  try {
    await runMigrations(db);
  } finally {
    await close();
  }

  project.provide('databaseUrl', databaseUrl);

  return async () => {
    await container.stop();
  };
}
