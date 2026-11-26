import { defineConfig, devices } from '@playwright/test';
import { apiUrl, databaseUrl, sessionFile, webUrl } from './support/env.js';

const isCI = Boolean(process.env.CI);
const port = (url: string) => new URL(url).port;

/**
 * Starts the built API (:4011) and web app (:3011) unless E2E_WEB_URL points at
 * running ones. The web app runs in production mode (`next start`).
 */
export default defineConfig({
  testDir: './specs',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright', open: 'never' }],
    ['junit', { outputFile: 'reports/junit.xml' }],
  ],
  use: {
    baseURL: webUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Signs in once through the login page and saves the session for the others.
    { name: 'setup', testMatch: /sign-in\.setup\.ts/, use: devices['Desktop Chrome'] },
    {
      name: 'signed-out',
      testMatch: /auth\.spec\.ts/,
      use: devices['Desktop Chrome'],
    },
    {
      name: 'chromium',
      testMatch: /(memories|accessibility)\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: sessionFile },
    },
    {
      name: 'no-javascript',
      testMatch: /no-javascript\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: sessionFile, javaScriptEnabled: false },
    },
  ],
  ...(process.env.E2E_WEB_URL === undefined && {
    webServer: [
      {
        command: 'pnpm --filter @mindbridge/api db:migrate && pnpm --filter @mindbridge/api start',
        url: `${apiUrl}/health`,
        reuseExistingServer: !isCI,
        timeout: 60_000,
        env: {
          HOST: '127.0.0.1',
          PORT: port(apiUrl),
          NODE_ENV: 'test',
          LOG_LEVEL: 'warn',
          DATABASE_URL: databaseUrl,
        },
      },
      {
        command: 'pnpm --filter @mindbridge/web start',
        url: `${webUrl}/login`,
        reuseExistingServer: !isCI,
        timeout: 60_000,
        env: {
          WEB_PORT: port(webUrl),
          MINDBRIDGE_API_URL: apiUrl,
          // Overrides a local apps/web/.env.local shortcut: the login flow is what we test.
          MINDBRIDGE_API_KEY: '',
        },
      },
    ],
  }),
});
