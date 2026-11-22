import { loadConfig } from '../config.js';
import { createDatabase } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';

const config = loadConfig();
const { db, close } = createDatabase(config.DATABASE_URL, { max: 1 });

try {
  await runMigrations(db);
  console.log('Migrations applied.');
} finally {
  await close();
}
