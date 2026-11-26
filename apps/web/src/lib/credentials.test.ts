import { describe, expect, it } from 'vitest';
import { resolveCredentials } from './credentials';

const COOKIE_KEY = `mb_${'c'.repeat(43)}`;
const ENV_KEY = `mb_${'e'.repeat(43)}`;

describe('resolveCredentials', () => {
  it('prefers an explicit sign-in over the configured key', () => {
    expect(resolveCredentials(COOKIE_KEY, ENV_KEY)).toEqual({ key: COOKIE_KEY, source: 'cookie' });
  });

  it('falls back to MINDBRIDGE_API_KEY, trimmed', () => {
    expect(resolveCredentials(undefined, `  ${ENV_KEY}\n`)).toEqual({
      key: ENV_KEY,
      source: 'env',
    });
  });

  it.each([
    ['nothing is set', undefined, undefined],
    ['the configured key is blank', undefined, '   '],
    ['the cookie is empty', '', undefined],
  ])('requires a sign-in when %s', (_case, cookie, configured) => {
    expect(resolveCredentials(cookie, configured)).toBeNull();
  });
});
