import { describe, expect, it } from 'vitest';
import {
  apiKeyNameSchema,
  displayPrefix,
  generateApiKey,
  hashApiKey,
  isWellFormedApiKey,
  parseBearerToken,
} from './api-key.js';

describe('generateApiKey', () => {
  it('produces a prefixed, well-formed key', () => {
    const key = generateApiKey();
    expect(key).toMatch(/^mb_[A-Za-z0-9_-]{43}$/);
    expect(isWellFormedApiKey(key)).toBe(true);
  });

  it('never repeats', () => {
    const keys = new Set(Array.from({ length: 1000 }, generateApiKey));
    expect(keys.size).toBe(1000);
  });
});

describe('hashApiKey', () => {
  it('is a deterministic SHA-256 hex digest that does not contain the key', () => {
    const key = generateApiKey();
    expect(hashApiKey(key)).toBe(hashApiKey(key));
    expect(hashApiKey(key)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(key)).not.toContain(key.slice(3));
  });

  it('differs for different keys', () => {
    expect(hashApiKey(generateApiKey())).not.toBe(hashApiKey(generateApiKey()));
  });
});

describe('displayPrefix', () => {
  it('reveals only the first 12 characters', () => {
    const key = generateApiKey();
    expect(displayPrefix(key)).toBe(key.slice(0, 12));
    expect(displayPrefix(key)).toHaveLength(12);
  });
});

describe('isWellFormedApiKey', () => {
  it.each([
    ['empty', ''],
    ['wrong prefix', `sk_${'a'.repeat(43)}`],
    ['too short', `mb_${'a'.repeat(42)}`],
    ['too long', `mb_${'a'.repeat(44)}`],
    ['non base64url characters', `mb_${'+'.repeat(43)}`],
    ['surrounding whitespace', ` ${generateApiKey()}`],
  ])('rejects a key that is %s', (_case, value) => {
    expect(isWellFormedApiKey(value)).toBe(false);
  });
});

describe('parseBearerToken', () => {
  it.each([
    ['Bearer abc', 'abc'],
    ['bearer abc', 'abc'],
    ['Bearer   abc  ', 'abc'],
  ])('reads %j', (header, token) => {
    expect(parseBearerToken(header)).toBe(token);
  });

  it.each([
    undefined,
    '',
    'Bearer',
    'Bearer ',
    'Basic dXNlcjpwYXNz',
    'Bearer a b',
    'abc',
    'xBearer abc',
  ])('returns null for %j', (header) => {
    expect(parseBearerToken(header)).toBeNull();
  });
});

describe('apiKeyNameSchema', () => {
  it.each(['claude-code', 'copilot-laptop', 'ci'])('accepts %j', (name) => {
    expect(apiKeyNameSchema.safeParse(name).success).toBe(true);
  });

  it.each(['', 'Claude Code', 'claude_code', 'x'.repeat(65)])('rejects %j', (name) => {
    expect(apiKeyNameSchema.safeParse(name).success).toBe(false);
  });
});
