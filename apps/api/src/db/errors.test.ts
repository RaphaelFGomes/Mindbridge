import { describe, expect, it } from 'vitest';
import { isUniqueViolation } from './errors.js';

const pgError = (code: string) => Object.assign(new Error('pg'), { code });

describe('isUniqueViolation', () => {
  it('detects a direct unique violation', () => {
    expect(isUniqueViolation(pgError('23505'))).toBe(true);
  });

  it('detects a unique violation wrapped in a cause chain', () => {
    const wrapped = new Error('query failed', {
      cause: new Error('driver', { cause: pgError('23505') }),
    });
    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it.each([
    ['another Postgres error', pgError('23503')],
    ['an error without code', new Error('boom')],
    ['a non-error value', '23505'],
    ['undefined', undefined],
  ])('returns false for %s', (_case, value) => {
    expect(isUniqueViolation(value)).toBe(false);
  });
});
