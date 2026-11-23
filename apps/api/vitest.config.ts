import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        // Process entry points: exercised end-to-end by the API test job, not in-process.
        'src/server.ts',
        'src/scripts/**',
      ],
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      // Ratchet: set just below the measured unit + integration coverage.
      // Raise when coverage goes up; never lower to make CI pass.
      thresholds: {
        statements: 98,
        branches: 90,
        functions: 100,
        lines: 98,
      },
    },
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
