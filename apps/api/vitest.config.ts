import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/integration/**/*.test.ts'],
          globalSetup: ['test/integration/global-setup.ts'],
          // Files share one Postgres container and truncate between tests.
          fileParallelism: false,
          testTimeout: 15_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
