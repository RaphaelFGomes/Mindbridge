import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Workspace packages resolve to source, like tsconfig's customConditions.
  ssr: {
    resolve: { conditions: ['@mindbridge/source', 'module', 'node', 'development|production'] },
  },
  resolve: { alias: { '@': fileURLToPath(new URL('src', import.meta.url)) } },
  test: {
    // See apps/api/vitest.config.ts: the on-disk module cache proved non-deterministic.
    fsModuleCache: false,
    // Pure logic only; pages and components are covered by the browser E2E suite.
    include: ['src/lib/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      // Server-only glue (cookies, API wiring): exercised end to end.
      exclude: ['src/lib/**/*.test.ts', 'src/lib/session.ts', 'src/lib/api.ts'],
      reporter: [
        'text',
        'html',
        ['lcov', { projectRoot: fileURLToPath(new URL('../..', import.meta.url)) }],
        'json-summary',
      ],
      // Ratchet: just below measured coverage. Raise when it goes up; never lower.
      thresholds: {
        statements: 99,
        branches: 94,
        functions: 100,
        lines: 100,
      },
    },
  },
});
