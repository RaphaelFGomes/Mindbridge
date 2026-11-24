import { z } from 'zod';

export const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A kebab-case identifier such as "prefers-pnpm" or "claude-code". */
export function slugSchema(max: number) {
  return z
    .string()
    .min(1)
    .max(max)
    .regex(KEBAB_CASE, { error: 'must be kebab-case (e.g. "prefers-pnpm")' });
}
