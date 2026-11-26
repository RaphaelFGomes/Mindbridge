import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // See apps/api/vitest.config.ts: the on-disk module cache proved non-deterministic.
    fsModuleCache: false,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/generated/**', 'src/index.ts'],
      reporter: [
        'text',
        'html',
        // Repo-relative paths, so Codecov maps files without path fixes.
        ['lcov', { projectRoot: fileURLToPath(new URL('../..', import.meta.url)) }],
        'json-summary',
      ],
      // Ratchet: just below measured coverage. Raise when it goes up; never lower.
      thresholds: {
        statements: 99,
        branches: 93,
        functions: 100,
        lines: 100,
      },
    },
  },
});
