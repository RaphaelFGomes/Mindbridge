import { describe, expect, it } from 'vitest';
import { slugSchema } from './slug.js';

describe('slugSchema', () => {
  const messages = (value: string) =>
    slugSchema(10)
      .safeParse(value)
      .error?.issues.map((issue) => issue.message);

  it('explains blank and non-kebab values', () => {
    expect(messages('')).toEqual(['must not be blank', 'must be kebab-case (e.g. "prefers-pnpm")']);
    expect(messages('Not Kebab')).toEqual(['must be kebab-case (e.g. "prefers-pnpm")']);
  });

  it('enforces the given maximum length', () => {
    expect(slugSchema(10).safeParse('a'.repeat(10)).success).toBe(true);
    expect(slugSchema(10).safeParse('a'.repeat(11)).success).toBe(false);
  });
});
