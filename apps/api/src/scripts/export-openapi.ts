import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/client.js';

/**
 * Writes the OpenAPI document to apps/api/openapi.json. It is committed so that
 * clients (the MCP server) generate their types from it, and CI fails when it
 * drifts from the code. Needs no database: the client connects lazily.
 */
const OUTPUT = fileURLToPath(new URL('../../openapi.json', import.meta.url));

const database = createDatabase('postgres://unused:unused@127.0.0.1:1/unused');
const app = await buildApp({ db: database.db });

try {
  const response = await app.inject({ method: 'GET', url: '/openapi.json' });
  await writeFile(OUTPUT, `${JSON.stringify(response.json(), null, 2)}\n`);
  console.log(`OpenAPI document written to ${OUTPUT}`);
} finally {
  await app.close();
  await database.close();
}
