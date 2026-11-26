import { execFileSync } from 'node:child_process';
import { databaseUrl } from './env.js';

const KEY_PATTERN = /mb_[A-Za-z0-9_-]{43}/;

const cli = (...args: string[]) =>
  execFileSync('pnpm', ['--silent', '--filter', '@mindbridge/api', 'keys', ...args], {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

/** Creates an API key through the operator CLI, the way a user would. */
export function createKey(name: string): string {
  const output = cli('create', '--name', name, '--quiet');
  const key = KEY_PATTERN.exec(output)?.[0];
  if (!key) throw new Error(`Could not create API key "${name}":\n${output}`);
  return key;
}

export function revokeKey(name: string): void {
  cli('revoke', name);
}
