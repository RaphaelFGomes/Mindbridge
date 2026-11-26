import { describe, expect, it } from 'vitest';
import { safeNextPath } from './navigation';

describe('safeNextPath', () => {
  it.each(['/memories', '/memories/123?saved=1', '/memories?project=github.com/acme/widgets'])(
    'keeps the same-origin path %s',
    (path) => {
      expect(safeNextPath(path)).toBe(path);
    },
  );

  it.each([
    ['an absolute URL', 'https://evil.example/phish'],
    ['a protocol-relative URL', '//evil.example'],
    ['a backslash trick', '/\\evil.example'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a relative path', 'memories'],
    ['a control character', '/memories\n//evil.example'],
    ['an empty value', ''],
    ['a repeated parameter', ['/a', '/b']],
    ['no value', undefined],
  ])('falls back for %s', (_case, next) => {
    expect(safeNextPath(next)).toBe('/memories');
  });
});
