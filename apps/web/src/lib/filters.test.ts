import { describe, expect, it } from 'vitest';
import { MindbridgeApiError } from '@mindbridge/api-client';
import { pageHref, parseFilters, toFilterProblem, toListQuery } from './filters';

describe('parseFilters', () => {
  it('defaults to every memory, first page', () => {
    expect(parseFilters({})).toEqual({ includeGlobal: true, page: 1 });
  });

  it('reads project, type, global and page', () => {
    expect(
      parseFilters({
        project: ' GitHub.com/Acme/Widgets ',
        type: 'reference',
        global: 'exclude',
        page: '3',
      }),
    ).toEqual({
      project: 'github.com/acme/widgets',
      type: 'reference',
      includeGlobal: false,
      page: 3,
    });
  });

  it.each([
    ['an unknown type', { type: 'secret' }],
    ['a blank project', { project: '   ' }],
    ['page zero', { page: '0' }],
    ['a negative page', { page: '-2' }],
    ['a non-numeric page', { page: 'last' }],
  ])('ignores %s', (_case, params) => {
    expect(parseFilters(params)).toEqual({ includeGlobal: true, page: 1 });
  });

  it('uses the first value of repeated parameters', () => {
    expect(parseFilters({ type: ['user', 'project'] }).type).toBe('user');
  });
});

describe('toListQuery', () => {
  it('sends includeGlobal only with a project, and pages by 20', () => {
    expect(toListQuery({ includeGlobal: true, page: 1 })).toEqual({ limit: 20, offset: 0 });
    expect(
      toListQuery({ project: 'github.com/acme/widgets', includeGlobal: false, page: 3 }),
    ).toEqual({
      project: 'github.com/acme/widgets',
      includeGlobal: 'false',
      limit: 20,
      offset: 40,
    });
  });
});

describe('pageHref', () => {
  it('keeps the filters and drops defaults', () => {
    const filters = {
      project: 'github.com/acme/widgets',
      type: 'user' as const,
      includeGlobal: false,
      page: 1,
    };
    expect(pageHref(filters, 2)).toBe(
      '/memories?project=github.com%2Facme%2Fwidgets&type=user&global=exclude&page=2',
    );
    expect(pageHref({ includeGlobal: true, page: 2 }, 1)).toBe('/memories');
    expect(pageHref({ includeGlobal: true, page: 1 }, 3)).toBe('/memories?page=3');
  });
});

describe('toFilterProblem', () => {
  it('puts a rejected project filter under the project field', () => {
    const error = new MindbridgeApiError(400, 'VALIDATION_ERROR', 'The request is invalid.', [
      { path: 'querystring.project', message: 'must be a normalized git remote' },
    ]);
    expect(toFilterProblem(error)).toEqual({ project: 'must be a normalized git remote' });
  });

  it('falls back to a general message for other invalid filters', () => {
    const error = new MindbridgeApiError(400, 'VALIDATION_ERROR', 'The request is invalid.', [
      { path: 'querystring.limit', message: 'too big' },
    ]);
    expect(toFilterProblem(error)).toEqual({ message: 'The request is invalid.' });
  });

  it.each([
    ['a server error', new MindbridgeApiError(500, 'INTERNAL_ERROR', 'Boom')],
    ['a redirect', new Error('NEXT_REDIRECT')],
  ])('rethrows %s', (_case, error) => {
    expect(() => toFilterProblem(error)).toThrow(error);
  });
});
