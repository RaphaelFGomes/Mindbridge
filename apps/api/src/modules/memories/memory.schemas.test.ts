import { describe, expect, it } from 'vitest';
import {
  createMemoryBodySchema,
  listMemoriesQuerySchema,
  memoryNameSchema,
  projectKeySchema,
  toMemoryDto,
  updateMemoryBodySchema,
} from './memory.schemas.js';

describe('memoryNameSchema', () => {
  it.each(['a', 'prefers-pnpm', 'v2-api-design'])('accepts %j', (name) => {
    expect(memoryNameSchema.safeParse(name).success).toBe(true);
  });

  it.each([
    '',
    'Prefers-pnpm',
    'with space',
    '-leading',
    'trailing-',
    'double--dash',
    'x'.repeat(101),
  ])('rejects %j', (name) => {
    expect(memoryNameSchema.safeParse(name).success).toBe(false);
  });
});

describe('projectKeySchema', () => {
  it.each([
    'github.com/acme/widgets',
    'gitlab.example.org/group/sub/repo',
    'github.com/acme/my_repo.js',
  ])('accepts %j', (key) => {
    expect(projectKeySchema.safeParse(key).success).toBe(true);
  });

  it.each([
    'widgets',
    'https://github.com/acme/widgets',
    'git@github.com:acme/widgets.git',
    'GitHub.com/Acme/Widgets',
    'github.com/acme/widgets/',
    'github.com//widgets',
  ])('rejects %j', (key) => {
    expect(projectKeySchema.safeParse(key).success).toBe(false);
  });
});

describe('createMemoryBodySchema text fields', () => {
  const body = (description: string) => ({
    type: 'feedback',
    name: 'prefers-pnpm',
    description,
    content: 'The team uses pnpm.',
  });

  it('trims surrounding whitespace', () => {
    expect(createMemoryBodySchema.parse(body('  Use pnpm  ')).description).toBe('Use pnpm');
  });

  it.each([
    ['blank', '   '],
    ['empty', ''],
    ['containing NUL', 'Use\u0000pnpm'],
    ['longer than 200 characters before trimming', ` ${'x'.repeat(200)}`],
  ])('rejects a description that is %s', (_case, description) => {
    expect(createMemoryBodySchema.safeParse(body(description)).success).toBe(false);
  });
});

describe('updateMemoryBodySchema', () => {
  it('rejects an empty patch', () => {
    expect(updateMemoryBodySchema.safeParse({}).success).toBe(false);
  });

  it('rejects fields that cannot be patched', () => {
    expect(updateMemoryBodySchema.safeParse({ project: 'github.com/acme/widgets' }).success).toBe(
      false,
    );
  });

  it('accepts a single-field patch', () => {
    expect(updateMemoryBodySchema.parse({ content: '  new fact  ' })).toEqual({
      content: 'new fact',
    });
  });
});

describe('listMemoriesQuerySchema', () => {
  it('applies defaults', () => {
    expect(listMemoriesQuerySchema.parse({})).toEqual({
      includeGlobal: true,
      limit: 20,
      offset: 0,
    });
  });

  it('parses query-string values', () => {
    expect(
      listMemoriesQuerySchema.parse({ includeGlobal: 'false', limit: '5', offset: '10' }),
    ).toMatchObject({ includeGlobal: false, limit: 5, offset: 10 });
  });

  it.each([
    { limit: '0' },
    { limit: '101' },
    { offset: '-1' },
    { includeGlobal: 'maybe' },
    { includeGlobal: '1' },
    { offset: '' },
    { limit: ' 5' },
    { limit: '1e2' },
    { limit: '0x10' },
    { limit: '1.5' },
  ])('rejects %j', (query) => {
    expect(listMemoriesQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe('toMemoryDto', () => {
  it('serializes timestamps as ISO 8601 strings', () => {
    const createdAt = new Date('2026-01-02T03:04:05.678Z');
    const dto = toMemoryDto({
      id: '6f1c1f0e-2b8e-4d55-9a5e-0f4f3c2b1a00',
      project: null,
      type: 'user',
      name: 'prefers-concise-answers',
      description: 'Keep answers short',
      content: 'The user prefers concise answers.',
      createdAt,
      updatedAt: createdAt,
    });
    expect(dto.createdAt).toBe('2026-01-02T03:04:05.678Z');
    expect(dto.updatedAt).toBe('2026-01-02T03:04:05.678Z');
  });
});

describe('validation messages', () => {
  const message = (result: { error?: { issues: { message: string }[] } }) =>
    result.error?.issues.map((issue) => issue.message).join(' | ');
  const body = (overrides: Record<string, unknown>) => ({
    type: 'feedback',
    name: 'prefers-pnpm',
    description: 'Use pnpm',
    content: 'The team uses pnpm.',
    ...overrides,
  });

  it('explains each rule in plain words', () => {
    expect(message(projectKeySchema.safeParse('Widgets'))).toBe(
      'must be a normalized git remote (e.g. "github.com/acme/widgets")',
    );
    expect(message(memoryNameSchema.safeParse(''))).toContain('must not be blank');
    expect(message(memoryNameSchema.safeParse('Not Kebab'))).toBe(
      'must be kebab-case (e.g. "prefers-pnpm")',
    );
    expect(message(createMemoryBodySchema.safeParse(body({ description: '   ' })))).toBe(
      'must not be blank',
    );
    expect(message(createMemoryBodySchema.safeParse(body({ content: 'a\u0000b' })))).toBe(
      'must not contain NUL characters',
    );
    expect(message(updateMemoryBodySchema.safeParse({}))).toBe(
      'at least one field must be provided',
    );
  });
});
