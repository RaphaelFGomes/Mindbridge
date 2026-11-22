import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config.js';

const DATABASE_URL = 'postgres://user:pass@localhost:5432/db';

describe('loadConfig', () => {
  it('applies defaults when only DATABASE_URL is set', () => {
    expect(loadConfig({ DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: 4000,
      LOG_LEVEL: 'info',
      DATABASE_URL,
    });
  });

  it('coerces PORT from a string', () => {
    expect(loadConfig({ DATABASE_URL, PORT: '8080' }).PORT).toBe(8080);
  });

  it.each([
    ['DATABASE_URL is missing', {}],
    ['DATABASE_URL is not postgres', { DATABASE_URL: 'mysql://localhost/db' }],
    ['PORT is out of range', { DATABASE_URL, PORT: '70000' }],
    ['PORT is not a number', { DATABASE_URL, PORT: 'http' }],
    ['LOG_LEVEL is unknown', { DATABASE_URL, LOG_LEVEL: 'verbose' }],
  ])('throws a ConfigError when %s', (_case, env) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
  });

  it('names the offending variable in the error message', () => {
    expect(() => loadConfig({ DATABASE_URL, PORT: 'http' })).toThrow(/PORT/);
  });
});
