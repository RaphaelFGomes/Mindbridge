import { z } from 'zod';
import { MEMORY_TYPES, type MemoryRow } from '../../db/schema.js';
import { slugSchema } from '../../shared/slug.js';

/** Lowercase host + path segments, e.g. "github.com/acme/widgets". */
const PROJECT_KEY = /^[a-z0-9][a-z0-9.-]*(?:\/[a-z0-9._-]+)+$/;

export const memoryTypeSchema = z
  .enum(MEMORY_TYPES)
  .describe('user | feedback | project | reference');

export const memoryNameSchema = slugSchema(100).describe('Unique slug within the memory scope');

export const projectKeySchema = z
  .string()
  .max(255)
  .regex(PROJECT_KEY, { error: 'must be a normalized git remote (e.g. "github.com/acme/widgets")' })
  .describe('Normalized git remote. Omit or null for a global memory.');

// eslint-disable-next-line no-control-regex -- Postgres `text` cannot store NUL; reject it with a 400, not a 500.
const NO_NUL = /^[^\u0000]*$/;
const NOT_BLANK = /\S/;

/**
 * Free text that is trimmed before saving. `max` runs before the trim and
 * blankness is a regex, so the generated JSON Schema (maxLength + patterns)
 * accepts exactly what the API accepts.
 */
function textSchema(max: number) {
  return z
    .string()
    .max(max)
    .regex(NO_NUL, { error: 'must not contain NUL characters' })
    .regex(NOT_BLANK, { error: 'must not be blank' })
    .trim();
}

const descriptionSchema = textSchema(200).describe('One-line summary, used to decide relevance');

const contentSchema = textSchema(10_000).describe('The fact itself (markdown)');

export const memorySchema = z.object({
  id: z.uuid(),
  project: projectKeySchema.nullable(),
  type: memoryTypeSchema,
  name: memoryNameSchema,
  description: z.string(),
  content: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Memory = z.infer<typeof memorySchema>;

export const createMemoryBodySchema = z.strictObject({
  project: projectKeySchema.nullable().optional(),
  type: memoryTypeSchema,
  name: memoryNameSchema,
  description: descriptionSchema,
  content: contentSchema,
});

export type CreateMemoryBody = z.infer<typeof createMemoryBodySchema>;

export const updateMemoryBodySchema = z
  .strictObject({
    type: memoryTypeSchema.optional(),
    name: memoryNameSchema.optional(),
    description: descriptionSchema.optional(),
    content: contentSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    error: 'at least one field must be provided',
  })
  // `refine` is invisible to JSON Schema; document the same rule for clients and fuzzers.
  .meta({ minProperties: 1 });

export type UpdateMemoryBody = z.infer<typeof updateMemoryBodySchema>;

export const memoryIdParamsSchema = z.object({
  id: z.uuid(),
});

/**
 * Integer from a query string. Unlike `z.coerce.number()`, only plain decimal
 * digits are accepted: "", " 5", "0x10" and "1e2" are rejected, as the
 * documented `type: integer` says they should be.
 */
function queryInteger({ min, max, fallback }: { min: number; max: number; fallback: number }) {
  return z
    .preprocess(
      (value) => (typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value),
      // `meta` keeps the default visible in the generated (input) schema.
      z.number().int().min(min).max(max).meta({ default: fallback }),
    )
    .default(fallback);
}

export const listMemoriesQuerySchema = z.object({
  project: projectKeySchema.optional().describe('Only memories visible in this project'),
  includeGlobal: z
    .enum(['true', 'false'])
    .describe('With `project`, also return global memories')
    .default('true')
    .transform((value) => value === 'true'),
  type: memoryTypeSchema.optional(),
  limit: queryInteger({ min: 1, max: 100, fallback: 20 }),
  offset: queryInteger({ min: 0, max: 1_000_000, fallback: 0 }),
});

export type ListMemoriesQuery = z.infer<typeof listMemoriesQuerySchema>;

export const memoryListSchema = z.object({
  items: z.array(memorySchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});

export function toMemoryDto(row: MemoryRow): Memory {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
