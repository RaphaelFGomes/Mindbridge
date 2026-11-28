import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeFailure, runCli } from './cli.js';

describe('describeFailure', () => {
  it('turns an unreachable database into an instruction', () => {
    const error = new Error('Failed query: insert into "api_keys" ...', {
      cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
        code: 'ECONNREFUSED',
      }),
    });
    expect(describeFailure(error)).toBe(
      'Cannot connect to Postgres (DATABASE_URL). Is it running? Try: pnpm db:up',
    );
  });

  it('never prints the query parameters that drivers append to messages', () => {
    const error = new Error(
      'Failed query: insert into "api_keys" values ($1, $2, $3)\nparams: web,mb_7Vrn-yDWi,9f5e6fedacfbe758',
    );
    const message = describeFailure(error);
    expect(message).toBe('Failed query: insert into "api_keys" values ($1, $2, $3)');
    expect(message).not.toMatch(/params|mb_|9f5e6f/);
  });

  it('describes non-error values', () => {
    expect(describeFailure('plain failure')).toBe('plain failure');
  });
});

describe('runCli', () => {
  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  it('leaves the exit code alone when the command succeeds', async () => {
    await runCli(() => Promise.resolve());
    expect(process.exitCode).toBeUndefined();
  });

  it('prints one safe line and exits 1 when the command fails', async () => {
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await runCli(() => Promise.reject(new Error('Failed query: x\nparams: mb_secret')));
    expect(stderr).toHaveBeenCalledExactlyOnceWith('Failed query: x');
    expect(process.exitCode).toBe(1);
  });
});
