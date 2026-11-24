import { execFileSync } from 'node:child_process';
import { databaseUrl } from './support/env.js';

/** Revokes the key created by global setup, if any. */
export default function globalTeardown() {
  const name = process.env.MINDBRIDGE_API_KEY_NAME;
  if (!name) return;

  execFileSync('pnpm', ['--silent', '--filter', '@mindbridge/api', 'keys', 'revoke', name], {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
