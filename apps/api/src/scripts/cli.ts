import { isConnectionFailure } from '../db/errors.js';

/**
 * One-line, secret-free description of a CLI failure. Driver errors embed the
 * query parameters (e.g. key hashes) in their message, so only the first line
 * is ever printed.
 */
export function describeFailure(error: unknown): string {
  if (isConnectionFailure(error)) {
    return 'Cannot connect to Postgres (DATABASE_URL). Is it running? Try: pnpm db:up';
  }
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n')[0] ?? message;
}

/** Runs a CLI entry point: prints a safe message and exits 1 on failure. */
export async function runCli(main: () => Promise<void>): Promise<void> {
  try {
    await main();
  } catch (error) {
    console.error(describeFailure(error));
    process.exitCode = 1;
  }
}
