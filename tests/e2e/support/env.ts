import { fileURLToPath } from 'node:url';

/** Same defaults as docker-compose.yml, so `pnpm db:up && pnpm test:e2e` just works. */
export const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://mindbridge:mindbridge@localhost:5432/mindbridge';

/** Dedicated ports, so the suite never talks to (or collides with) `pnpm dev`. */
export const apiUrl = process.env.E2E_API_URL ?? 'http://127.0.0.1:4011';
export const webUrl = process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3011';

/** Browser session saved by the setup project. Contains an API key: git-ignored. */
export const sessionFile = fileURLToPath(new URL('../.auth/session.json', import.meta.url));
