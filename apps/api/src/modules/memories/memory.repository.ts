import { and, asc, count, eq, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { memories, type MemoryRow, type NewMemoryRow } from '../../db/schema.js';
import type { ListMemoriesQuery, UpdateMemoryBody } from './memory.schemas.js';

export class MemoryRepository {
  constructor(private readonly db: Database) {}

  async create(input: NewMemoryRow): Promise<MemoryRow> {
    const [row] = await this.db.insert(memories).values(input).returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  }

  async findById(id: string): Promise<MemoryRow | null> {
    const [row] = await this.db.select().from(memories).where(eq(memories.id, id));
    return row ?? null;
  }

  async list(query: ListMemoriesQuery): Promise<{ items: MemoryRow[]; total: number }> {
    const conditions: (SQL | undefined)[] = [];

    if (query.project !== undefined) {
      const inProject = eq(memories.project, query.project);
      conditions.push(query.includeGlobal ? or(inProject, isNull(memories.project)) : inProject);
    }
    if (query.type !== undefined) {
      conditions.push(eq(memories.type, query.type));
    }

    const where = and(...conditions);

    const [items, totals] = await Promise.all([
      this.db
        .select()
        .from(memories)
        .where(where)
        .orderBy(asc(memories.name), sql`${memories.project} asc nulls first`, asc(memories.id))
        .limit(query.limit)
        .offset(query.offset),
      this.db.select({ total: count() }).from(memories).where(where),
    ]);

    return { items, total: totals[0]?.total ?? 0 };
  }

  async update(id: string, patch: UpdateMemoryBody): Promise<MemoryRow | null> {
    const [row] = await this.db.update(memories).set(patch).where(eq(memories.id, id)).returning();
    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(memories)
      .where(eq(memories.id, id))
      .returning({ id: memories.id });
    return deleted.length > 0;
  }
}
