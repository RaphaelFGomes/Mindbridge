import { describe, expect, it } from 'vitest';
import { conflict, HttpProblem, notFound, problem, toProblem, unauthorized } from './errors.js';

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

describe('problem titles', () => {
  it('falls back to a generic title for unknown status codes', () => {
    expect(problem(599, 'X').title).toBe('Unknown Error');
  });
});

describe('toProblem', () => {
  const fastifyError = (statusCode: number, message: string) =>
    Object.assign(new Error(message), { statusCode, code: `FST_${statusCode}` });

  it('keeps an HttpProblem as is', () => {
    expect(toProblem(notFound('Memory x not found.'))).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      detail: 'Memory x not found.',
    });
    expect(notFound('x').name).toBe('HttpProblem');
  });

  it('explains the API key requirement on 401', () => {
    expect(toProblem(unauthorized())).toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
      detail: 'A valid API key is required: Authorization: Bearer <key>.',
    });
  });

  it.each([400, 413, 499])('passes framework client errors through (%i)', (status) => {
    expect(toProblem(fastifyError(status, 'Body is too large'))).toMatchObject({
      status,
      code: `FST_${status}`,
      detail: 'Body is too large',
    });
  });

  it.each([
    ['a 5xx framework error', fastifyError(500, 'connect ECONNREFUSED 10.0.0.5:5432')],
    ['a 503 framework error', fastifyError(503, 'pool exhausted at db.internal')],
    ['a status below 400', fastifyError(399, 'odd')],
    ['a plain error', new Error('relation "secrets" does not exist')],
    ['a non-error value', 'boom'],
  ])('turns %s into a generic 500 that leaks nothing', (_case, error) => {
    expect(toProblem(error)).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      code: 'INTERNAL_ERROR',
      detail: 'An unexpected error occurred.',
    });
  });
});
