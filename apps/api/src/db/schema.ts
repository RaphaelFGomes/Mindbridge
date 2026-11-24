import { sql } from 'drizzle-orm';
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Memory types, one fact per memory:
 * - user: who the user is (role, expertise, preferences)
 * - feedback: guidance on how the assistant should work
 * - project: ongoing work, goals, constraints
 * - reference: pointers to external resources
 */
export const MEMORY_TYPES = ['user', 'feedback', 'project', 'reference'] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export const memoryType = pgEnum('memory_type', MEMORY_TYPES);

export const memories = pgTable(
  'memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Normalized git remote (e.g. "github.com/acme/widgets"). NULL means global. */
    project: text('project'),
    type: memoryType('type').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    // One name per scope; NULLS NOT DISTINCT so global names are unique too.
    unique('memories_project_name_key').on(table.project, table.name).nullsNotDistinct(),
    index('memories_project_type_idx').on(table.project, table.type),
  ],
);

export type MemoryRow = typeof memories.$inferSelect;
export type NewMemoryRow = typeof memories.$inferInsert;

/**
 * API keys, one per assistant or machine. Only a SHA-256 hash is stored: the
 * plaintext key is shown once at creation. A fast hash is enough because keys
 * carry 256 bits of randomness (slow hashes like bcrypt protect low-entropy
 * passwords).
 */
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    /** First characters of the key, safe to display ("mb_9xQ2…"). */
    prefix: text('prefix').notNull(),
    keyHash: text('key_hash').notNull().unique('api_keys_key_hash_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    // Names identify active keys; a revoked key's name can be reused.
    uniqueIndex('api_keys_active_name_key')
      .on(table.name)
      .where(sql`${table.revokedAt} is null`),
  ],
);

export type ApiKeyRow = typeof apiKeys.$inferSelect;
