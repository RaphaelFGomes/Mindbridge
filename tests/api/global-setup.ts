import { execFileSync } from 'node:child_process';
import { databaseUrl } from './support/env.js';

const KEY_PATTERN = /mb_[A-Za-z0-9_-]{43}/;

/**
 * Unless MINDBRIDGE_API_KEY is provided (CI does), create a throwaway key with
 * the operator CLI. Runs after the web server, i.e. after migrations.
 */
export default function globalSetup() {
  if (process.env.MINDBRIDGE_API_KEY) return;

  const name = `api-tests-${Date.now()}`;
  const output = execFileSync(
    'pnpm',
    ['--silent', '--filter', '@mindbridge/api', 'keys', 'create', '--name', name, '--quiet'],
    { encoding: 'utf8', env: { ...process.env, DATABASE_URL: databaseUrl } },
  );
  const key = KEY_PATTERN.exec(output)?.[0];
  if (!key) throw new Error(`Could not create an API key for the test run:\n${output}`);

  // Workers inherit these; teardown revokes the key.
  process.env.MINDBRIDGE_API_KEY = key;
  process.env.MINDBRIDGE_API_KEY_NAME = name;
}
