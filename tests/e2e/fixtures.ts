import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';
import { apiUrl } from './support/env.js';

export interface Memory {
  id: string;
  project: string | null;
  type: 'user' | 'feedback' | 'project' | 'reference';
  name: string;
  description: string;
  content: string;
}

export const runKey = () => {
  const key = process.env.E2E_API_KEY;
  if (!key) throw new Error('E2E_API_KEY is not set; global setup should have created one');
  return key;
};

export interface Seeder {
  /** Creates a memory through the API (fast setup); deleted after the test. */
  memory: (overrides?: Partial<Omit<Memory, 'id'>>) => Promise<Memory>;
  /** Registers a memory created through the UI for cleanup. */
  track: (id: string) => void;
  api: APIRequestContext;
}

interface Fixtures {
  /** A project no other test uses: tests run in parallel against one database. */
  project: string;
  seed: Seeder;
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring pattern here.
  project: async ({}, use) => {
    await use(`github.com/e2e/${randomUUID()}`);
  },

  seed: async ({ playwright, project }, use) => {
    const api = await playwright.request.newContext({
      baseURL: apiUrl,
      extraHTTPHeaders: { authorization: `Bearer ${runKey()}` },
    });
    const created = new Set<string>();
    await use({
      api,
      track: (id) => created.add(id),
      memory: async (overrides = {}) => {
        const response = await api.post('/v1/memories', {
          data: {
            project,
            type: 'feedback',
            name: `memory-${randomUUID()}`,
            description: 'Use pnpm, never npm',
            content: 'The widgets team standardized on pnpm workspaces.',
            ...overrides,
          },
        });
        expect(response.status(), await response.text()).toBe(201);
        const memory = (await response.json()) as Memory;
        created.add(memory.id);
        return memory;
      },
    });
    await Promise.all([...created].map((id) => api.delete(`/v1/memories/${id}`)));
    await api.dispose();
  },
});

/** Memory id from a /memories/<id> URL, to clean up what a test created through the UI. */
export function memoryIdFrom(page: Page): string {
  const id = /\/memories\/([0-9a-f-]{36})/.exec(page.url())?.[1];
  if (!id) throw new Error(`Not on a memory page: ${page.url()}`);
  return id;
}

/** Fails with one line per WCAG 2.2 A/AA violation, naming the offending elements. */
export async function expectAccessible(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const report = violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? 'n/a'}): ${violation.help} → ${violation.nodes
        .map((node) => node.target.join(' '))
        .join(', ')}`,
  );
  expect(report, `accessibility violations on ${page.url()}`).toEqual([]);
}

export { expect } from '@playwright/test';
