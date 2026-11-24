/** Same defaults as docker-compose.yml, so `pnpm db:up && pnpm test:api` just works. */
export const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://mindbridge:mindbridge@localhost:5432/mindbridge';
