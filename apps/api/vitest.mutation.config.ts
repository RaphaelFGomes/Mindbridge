import { defineConfig } from 'vitest/config';

/**
 * Mutation testing (Stryker) runs the unit suite only: integration tests need a
 * Postgres container and would rerun for every mutant. Modules only they reach
 * are excluded from mutation in stryker.config.json.
 */
export default defineConfig({
  test: {
    fsModuleCache: false,
    include: ['src/**/*.test.ts'],
  },
});
