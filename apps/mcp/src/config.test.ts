import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config.js';

const KEY = `mb_${'a'.repeat(43)}`;

describe('loadConfig', () => {
  it('defaults the API URL to the local API', () => {
    expect(loadConfig({ MINDBRIDGE_API_KEY: KEY })).toEqual({
      MINDBRIDGE_API_URL: 'http://127.0.0.1:4000',
      MINDBRIDGE_API_KEY: KEY,
      MINDBRIDGE_PROJECT: undefined,
    });
  });

  it('normalizes the project override and ignores an empty one', () => {
    expect(
      loadConfig({ MINDBRIDGE_API_KEY: KEY, MINDBRIDGE_PROJECT: ' GitHub.com/Acme/Widgets ' }),
    ).toMatchObject({ MINDBRIDGE_PROJECT: 'github.com/acme/widgets' });
    expect(
      loadConfig({ MINDBRIDGE_API_KEY: KEY, MINDBRIDGE_PROJECT: '' }).MINDBRIDGE_PROJECT,
    ).toBeUndefined();
  });

  it.each([
    ['the API key is missing', {}],
    ['the API key is malformed', { MINDBRIDGE_API_KEY: 'sk-123' }],
    ['the API URL is not http(s)', { MINDBRIDGE_API_KEY: KEY, MINDBRIDGE_API_URL: 'ftp://api' }],
  ])('throws a ConfigError when %s', (_case, env) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
  });

  it('tells the user how to get a key', () => {
    expect(() => loadConfig({})).toThrow(/keys:create/);
  });
});
