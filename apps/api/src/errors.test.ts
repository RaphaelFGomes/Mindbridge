import { describe, expect, it } from 'vitest';
import { conflict, HttpProblem, notFound, problem } from './errors.js';

describe('problem', () => {
  it('builds an RFC 9457 body with the standard status title', () => {
    expect(problem(404, 'NOT_FOUND', 'Memory x not found.')).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: 'NOT_FOUND',
      detail: 'Memory x not found.',
    });
  });

  it('omits optional members that were not provided', () => {
    expect(problem(500, 'INTERNAL_ERROR')).not.toHaveProperty('detail');
    expect(problem(500, 'INTERNAL_ERROR')).not.toHaveProperty('errors');
  });

  it('includes field errors when provided', () => {
    const errors = [{ path: 'body.name', message: 'must be kebab-case' }];
    expect(problem(400, 'VALIDATION_ERROR', 'Invalid', errors).errors).toEqual(errors);
  });
});

describe('HttpProblem factories', () => {
  it.each([
    [notFound, 404, 'NOT_FOUND'],
    [conflict, 409, 'CONFLICT'],
  ] as const)('%o maps to %i %s', (factory, status, code) => {
    const error = factory('detail');
    expect(error).toBeInstanceOf(HttpProblem);
    expect(error).toMatchObject({ status, code, message: 'detail' });
  });
});
