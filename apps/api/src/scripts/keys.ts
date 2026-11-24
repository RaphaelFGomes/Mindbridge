import { parseArgs } from 'node:util';
import { loadConfig } from '../config.js';
import { createDatabase } from '../db/client.js';
import { isUniqueViolation } from '../db/errors.js';
import { apiKeyNameSchema } from '../modules/api-keys/api-key.js';
import { ApiKeyRepository } from '../modules/api-keys/api-key.repository.js';

const USAGE = `Manage Mindbridge API keys.

Usage:
  keys create --name <kebab-name> [--quiet]  Create a key; it is printed once
  keys list                                  List keys (secrets are never shown)
  keys revoke <name>                         Revoke the active key with this name`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: 'string' },
    quiet: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});
const [command, argument] = positionals;

const fail = (message: string) => {
  console.error(message);
  process.exitCode = 1;
};

const formatDate = (date: Date | null) => (date ? date.toISOString() : '-');

if (values.help || command === undefined) {
  console.log(USAGE);
} else {
  const { db, close } = createDatabase(loadConfig().DATABASE_URL, { max: 1 });
  const keys = new ApiKeyRepository(db);

  try {
    switch (command) {
      case 'create': {
        const name = apiKeyNameSchema.safeParse(values.name);
        if (!name.success) {
          fail('--name is required and must be kebab-case, e.g. --name claude-code');
          break;
        }
        try {
          const { key, info } = await keys.create(name.data);
          if (values.quiet) {
            console.log(key);
          } else {
            console.log(`Created key "${info.name}" (${info.prefix}…).`);
            console.log('Store it now; it will not be shown again:\n');
            console.log(`  ${key}\n`);
          }
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
          fail(
            `An active key named "${name.data}" already exists. Revoke it or pick another name.`,
          );
        }
        break;
      }

      case 'list': {
        const rows = await keys.list();
        if (rows.length === 0) {
          console.log('No API keys yet. Create one with: keys create --name <name>');
          break;
        }
        console.table(
          rows.map((row) => ({
            name: row.name,
            prefix: `${row.prefix}…`,
            created: formatDate(row.createdAt),
            'last used': formatDate(row.lastUsedAt),
            status: row.revokedAt ? `revoked ${formatDate(row.revokedAt)}` : 'active',
          })),
        );
        break;
      }

      case 'revoke': {
        if (argument === undefined) {
          fail('Usage: keys revoke <name>');
          break;
        }
        if (await keys.revoke(argument)) {
          console.log(`Revoked "${argument}".`);
        } else {
          fail(`No active key named "${argument}".`);
        }
        break;
      }

      default:
        fail(`Unknown command "${command}".\n\n${USAGE}`);
    }
  } finally {
    await close();
  }
}
