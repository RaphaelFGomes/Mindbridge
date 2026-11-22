import { z } from 'zod';
import { MEMORY_TYPES, type MemoryRow } from '../../db/schema.js';

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Lowercase host + path segments, e.g. "github.com/acme/widgets". */
const PROJECT_KEY = /^[a-z0-9][a-z0-9.-]*(?:\/[a-z0-9._-]+)+$/;

export const memoryTypeSchema = z
  .enum(MEMORY_TYPES)
  .describe('user | feedback | project | reference');

export const memoryNameSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(KEBAB_CASE, { error: 'must be kebab-case (e.g. "prefers-pnpm")' })
  .describe('Unique slug within the memory scope');

export const projectKeySchema = z
  .string()
  .max(255)
  .regex(PROJECT_KEY, { error: 'must be a normalized git remote (e.g. "github.com/acme/widgets")' })
  .describe('Normalized git remote. Omit or null for a global memory.');

const descriptionSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .describe('One-line summary, used to decide relevance');

const contentSchema = z.string().trim().min(1).max(10_000).describe('The fact itself (markdown)');

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
  });

export type UpdateMemoryBody = z.infer<typeof updateMemoryBodySchema>;

export const memoryIdParamsSchema = z.object({
  id: z.uuid(),
});

export const listMemoriesQuerySchema = z.object({
  project: projectKeySchema.optional().describe('Only memories visible in this project'),
  includeGlobal: z
    .stringbool()
    .default(true)
    .describe('With `project`, also return global memories (default true)'),
  type: memoryTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
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
