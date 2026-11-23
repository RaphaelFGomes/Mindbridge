import { randomUUID } from 'node:crypto';
import { test as base } from '@playwright/test';
import { loadContract, type Contract } from './support/contract.js';
import { MemoriesClient, type NewMemory } from './support/memories-client.js';

interface WorkerFixtures {
  contract: Contract;
}

interface TestFixtures {
  memories: MemoriesClient;
  /** A project key no other test uses, so tests can run in parallel on one database. */
  project: string;
  /** Builds a valid memory in `project` with a unique name. */
  memory: (overrides?: Partial<NewMemory>) => NewMemory;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  contract: [
    async ({ playwright }, use, workerInfo) => {
      const request = await playwright.request.newContext({
        baseURL: workerInfo.project.use.baseURL,
      });
      await use(await loadContract(request));
      await request.dispose();
    },
    { scope: 'worker' },
  ],

  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring pattern here.
  project: async ({}, use) => {
    await use(`github.com/api-tests/${randomUUID()}`);
  },

  memory: async ({ project }, use) => {
    await use((overrides = {}) => ({
      project,
      type: 'feedback',
      name: `memory-${randomUUID()}`,
      description: 'Use pnpm, never npm',
      content: 'The widgets team standardized on pnpm workspaces.',
      ...overrides,
    }));
  },

  memories: async ({ request, contract }, use) => {
    const client = new MemoriesClient(request, contract);
    await use(client);
    await client.cleanup();
  },
});

export { expect } from '@playwright/test';
