import { describe, expect, it } from 'vitest';
import { isConnectionFailure, isUniqueViolation } from './errors.js';

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

describe('isConnectionFailure', () => {
  // The shape node-postgres drivers produce when Postgres is down: an AggregateError
  // (one attempt per address) wrapped by the ORM.
  const refused = () =>
    new Error('Failed query: insert into ...', {
      cause: Object.assign(new AggregateError([new Error('connect ECONNREFUSED ::1:5432')]), {
        code: 'ECONNREFUSED',
      }),
    });

  it('detects a refused connection wrapped by the ORM', () => {
    expect(isConnectionFailure(refused())).toBe(true);
  });

  it.each(['ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH', 'EPERM'])('detects %s', (code) => {
    expect(isConnectionFailure(pgError(code))).toBe(true);
  });

  it.each([
    ['a unique violation', pgError('23505')],
    ['an error without code', new Error('boom')],
    ['a non-error value', 'ECONNREFUSED'],
  ])('returns false for %s', (_case, value) => {
    expect(isConnectionFailure(value)).toBe(false);
  });
});
