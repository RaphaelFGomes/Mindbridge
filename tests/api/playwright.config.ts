import { defineConfig } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const port = 4010;

/**
 * Against an already running API: API_URL=http://host:port pnpm test:api
 * Otherwise Playwright migrates and starts the built API on :4010, using
 * DATABASE_URL (default: the docker-compose database).
 */
const externalUrl = process.env.API_URL;

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright', open: 'never' }],
    ['junit', { outputFile: 'reports/junit.xml' }],
  ],
  use: {
    baseURL: externalUrl ?? `http://127.0.0.1:${port}`,
    extraHTTPHeaders: { accept: 'application/json, application/problem+json' },
  },
  ...(externalUrl === undefined && {
    webServer: {
      command: 'pnpm --filter @mindbridge/api db:migrate && pnpm --filter @mindbridge/api start',
      url: `http://127.0.0.1:${port}/health`,
      reuseExistingServer: !isCI,
      timeout: 60_000,
      env: {
        HOST: '127.0.0.1',
        PORT: String(port),
        NODE_ENV: 'test',
        LOG_LEVEL: 'warn',
        DATABASE_URL:
          process.env.DATABASE_URL ?? 'postgres://mindbridge:mindbridge@localhost:5432/mindbridge',
      },
    },
  }),
});
