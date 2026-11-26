import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { expect, test } from '../fixtures.js';
import type { Memory } from '../support/memories-client.js';

/**
 * End to end: the real MCP server binary over stdio, talking to the real API.
 * What an assistant does through MCP must be what the REST API stores.
 */
const call = async (client: Client, name: string, args: Record<string, unknown> = {}) =>
  (await client.callTool({ name, arguments: args })) as CallToolResult;

const text = (result: CallToolResult) =>
  result.content.map((part) => (part.type === 'text' ? part.text : '')).join('\n');

const savedMemory = (result: CallToolResult) => {
  expect(result.isError, text(result)).toBeFalsy();
  return (result.structuredContent as { memory: Memory }).memory;
};

test.describe('MCP server (stdio)', () => {
  test('offers the memory tools', async ({ connectMcp }) => {
    const client = await connectMcp();
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'delete_memory',
      'get_memory',
      'memory_index',
      'save_memory',
      'update_memory',
    ]);
    expect(client.getServerVersion()?.name).toBe('mindbridge');
  });

  test('a memory saved through MCP is stored by the API in the current project', async ({
    connectMcp,
    memories,
    project,
  }) => {
    const client = await connectMcp();

    const saved = savedMemory(
      await call(client, 'save_memory', {
        type: 'project',
        name: 'deploy-freeze',
        description: 'No deploys until the 2nd',
        content: 'Release freeze agreed with the platform team.',
      }),
    );
    memories.track(saved.id);

    const stored = await memories.listOk({ project, includeGlobal: false });
    expect(stored.items).toEqual([saved]);
    expect(saved.project).toBe(project);
  });

  test('what the API stores is what memory_index and get_memory return', async ({
    connectMcp,
    memories,
    memory,
    project,
  }) => {
    const created = await memories.createOk(memory({ content: 'Use pnpm 12 or newer.' }));
    const client = await connectMcp();

    const index = await call(client, 'memory_index');
    expect(text(index)).toContain(`## Project ${project} (1)`);
    expect(text(index)).toContain(`[feedback] ${created.name}`);

    const read = await call(client, 'get_memory', { id: created.id });
    expect(text(read)).toContain('Use pnpm 12 or newer.');
    expect(read.structuredContent).toEqual({ memory: created });
  });

  test('updates and deletes made through MCP reach the API', async ({
    connectMcp,
    memories,
    memory,
  }) => {
    const created = await memories.createOk(memory());
    const client = await connectMcp();

    const updated = savedMemory(
      await call(client, 'update_memory', { id: created.id, content: 'Updated over MCP.' }),
    );
    expect(updated.content).toBe('Updated over MCP.');
    expect(await (await memories.get(created.id)).json()).toMatchObject({
      content: 'Updated over MCP.',
    });

    const deleted = await call(client, 'delete_memory', { id: created.id });
    expect(text(deleted)).toBe(`Deleted memory ${created.id}.`);
    expect((await memories.get(created.id)).status()).toBe(404);
  });

  test('detects the project from the git remote of its working directory', async ({
    connectMcp,
    memories,
  }) => {
    const id = randomUUID();
    const repo = mkdtempSync(join(tmpdir(), 'mindbridge-e2e-'));
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: repo });
      execFileSync('git', ['remote', 'add', 'origin', `git@github.com:API-Tests/${id}.git`], {
        cwd: repo,
      });
      const client = await connectMcp({ project: null, cwd: repo });

      const saved = savedMemory(
        await call(client, 'save_memory', {
          type: 'reference',
          name: 'runbook',
          description: 'Where the runbook lives',
          content: 'See the team wiki, section Operations.',
        }),
      );
      memories.track(saved.id);

      expect(saved.project).toBe(`github.com/api-tests/${id}`);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('reports a rejected API key as a tool error the assistant can act on', async ({
    connectMcp,
  }) => {
    const client = await connectMcp({ apiKey: `mb_${'A'.repeat(43)}` });

    const result = await call(client, 'memory_index');

    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/MINDBRIDGE_API_KEY/);
  });

  test('refuses to start without an API key and says how to get one', () => {
    const server = fileURLToPath(new URL('../../../apps/mcp/dist/index.js', import.meta.url));
    const run = spawnSync(process.execPath, [server], {
      env: { PATH: process.env.PATH ?? '' },
      encoding: 'utf8',
      timeout: 10_000,
    });

    expect(run.status).toBe(1);
    expect(run.stdout).toBe(''); // stdout is reserved for the protocol
    // Names the setting and how to fix it (order is up to the formatter).
    expect(run.stderr).toContain('MINDBRIDGE_API_KEY');
    expect(run.stderr).toContain('keys:create');
  });
});
