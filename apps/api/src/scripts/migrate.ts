import { loadConfig } from '../config.js';
import { createDatabase } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { runCli } from './cli.js';

await runCli(async () => {
  const { db, close } = createDatabase(loadConfig().DATABASE_URL, { max: 1 });
  try {
    await runMigrations(db);
    console.log('Migrations applied.');
  } finally {
    await close();
  }
});
