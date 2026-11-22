import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export interface DatabaseOptions {
  /** Max pool size. */
  max?: number;
  /** Seconds to wait for a connection before failing. */
  connectTimeout?: number;
}

export function createDatabase(
  url: string,
  { max = 10, connectTimeout = 10 }: DatabaseOptions = {},
) {
  const client = postgres(url, {
    max,
    connect_timeout: connectTimeout,
    onnotice: () => undefined,
  });
  const db = drizzle(client, { schema });

  return {
    db,
    close: () => client.end({ timeout: 5 }),
  };
}

export type Database = ReturnType<typeof createDatabase>['db'];
