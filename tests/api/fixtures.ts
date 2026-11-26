import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import { test as base, type APIRequestContext } from '@playwright/test';
import { loadContract, type Contract } from './support/contract.js';
import { MemoriesClient, type NewMemory } from './support/memories-client.js';

/** The built MCP server binary, run exactly as an assistant would spawn it. */
const MCP_SERVER = fileURLToPath(new URL('../../apps/mcp/dist/index.js', import.meta.url));

export interface McpOptions {
  /** Defaults to the test's project; null leaves MINDBRIDGE_PROJECT unset (git detection). */
  project?: string | null;
  apiKey?: string;
  cwd?: string;
}

const testRunKey = () => {
  const key = process.env.MINDBRIDGE_API_KEY;
  if (!key) throw new Error('MINDBRIDGE_API_KEY is not set; global setup should have created one');
  return key;
};

interface WorkerFixtures {
  contract: Contract;
}

interface TestFixtures {
  /** Like `request`, but authenticated with the test run's API key. */
  api: APIRequestContext;
  memories: MemoriesClient;
  /** A project key no other test uses, so tests can run in parallel on one database. */
  project: string;
  /** Builds a valid memory in `project` with a unique name. */
  memory: (overrides?: Partial<NewMemory>) => NewMemory;
  /** Spawns the MCP server over stdio and returns a connected MCP client. */
  connectMcp: (options?: McpOptions) => Promise<Client>;
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

  api: async ({ playwright, baseURL }, use) => {
    const api = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        accept: 'application/json, application/problem+json',
        authorization: `Bearer ${testRunKey()}`,
      },
    });
    await use(api);
    await api.dispose();
  },

  connectMcp: async ({ baseURL, project }, use) => {
    const clients: Client[] = [];
    await use(async ({ project: scope = project, apiKey = testRunKey(), cwd } = {}) => {
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [MCP_SERVER],
        ...(cwd !== undefined && { cwd }),
        // Safe defaults (PATH, HOME...) plus Mindbridge settings: nothing else leaks in.
        env: {
          ...getDefaultEnvironment(),
          MINDBRIDGE_API_URL: baseURL ?? '',
          MINDBRIDGE_API_KEY: apiKey,
          ...(scope !== null && { MINDBRIDGE_PROJECT: scope }),
        },
        stderr: 'pipe',
      });
      const client = new Client({ name: 'mindbridge-e2e', version: '0.0.0' });
      await client.connect(transport);
      clients.push(client);
      return client;
    });
    await Promise.all(clients.map((client) => client.close()));
  },

  memories: async ({ api, contract }, use) => {
    const client = new MemoriesClient(api, contract);
    await use(client);
    await client.cleanup();
  },
});

export { expect } from '@playwright/test';
