import { and, asc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { apiKeys } from '../../db/schema.js';
import { displayPrefix, generateApiKey, hashApiKey } from './api-key.js';

/** What the rest of the app knows about the caller. Never the key itself. */
export interface AuthenticatedKey {
  id: string;
  name: string;
}

/** The only capability the auth hook needs; lets unit tests run without a database. */
export interface ApiKeyStore {
  authenticate(key: string): Promise<AuthenticatedKey | null>;
}

const publicColumns = {
  id: apiKeys.id,
  name: apiKeys.name,
  prefix: apiKeys.prefix,
  createdAt: apiKeys.createdAt,
  lastUsedAt: apiKeys.lastUsedAt,
  revokedAt: apiKeys.revokedAt,
};

export class ApiKeyRepository implements ApiKeyStore {
  constructor(private readonly db: Database) {}

  /** Creates a key. The plaintext is returned once and never stored. */
  async create(name: string) {
    const key = generateApiKey();
    const [info] = await this.db
      .insert(apiKeys)
      .values({ name, prefix: displayPrefix(key), keyHash: hashApiKey(key) })
      .returning(publicColumns);
    if (!info) throw new Error('Insert returned no row');
    return { key, info };
  }

  async list() {
    return this.db.select(publicColumns).from(apiKeys).orderBy(asc(apiKeys.createdAt));
  }

  /** Revokes the active key with this name. Returns false if there is none. */
  async revoke(name: string): Promise<boolean> {
    const revoked = await this.db
      .update(apiKeys)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(apiKeys.name, name), isNull(apiKeys.revokedAt)))
      .returning({ id: apiKeys.id });
    return revoked.length > 0;
  }

  async authenticate(key: string): Promise<AuthenticatedKey | null> {
    const [found] = await this.db
      .select({ id: apiKeys.id, name: apiKeys.name })
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, hashApiKey(key)), isNull(apiKeys.revokedAt)));
    if (!found) return null;

    // Record usage at most once a minute, so authentication is not a write per request.
    await this.db
      .update(apiKeys)
      .set({ lastUsedAt: sql`now()` })
      .where(
        and(
          eq(apiKeys.id, found.id),
          or(isNull(apiKeys.lastUsedAt), lt(apiKeys.lastUsedAt, sql`now() - interval '1 minute'`)),
        ),
      );
    return found;
  }
}
