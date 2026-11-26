import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createApiClient, type Memory } from '@mindbridge/api-client';
import { createServer } from './server.js';

const API_URL = 'http://api.test';
const KEY = `mb_${'k'.repeat(43)}`;
const PROJECT = 'github.com/acme/widgets';

const memory = (overrides: Partial<Memory> = {}): Memory => ({
  id: '6f1c1f0e-2b8e-4d55-9a5e-0f4f3c2b1a00',
  project: PROJECT,
  type: 'feedback',
  name: 'prefers-pnpm',
  description: 'Use pnpm, never npm',
  content: 'The widgets team standardized on pnpm workspaces.',
  createdAt: '2026-11-25T10:00:00.000Z',
  updatedAt: '2026-11-25T10:00:00.000Z',
  ...overrides,
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': status >= 400 ? 'application/problem+json' : 'application/json',
    },
  });

const problem = (status: number, code: string, detail: string, errors?: object[]) =>
  json(status, { type: 'about:blank', title: 'x', status, code, detail, errors });

const page = (items: Memory[], total = items.length) =>
  json(200, { items, total, limit: 100, offset: 0 });

/** Fake API: answers with queued responses and records every request it receives. */
function fakeApi(...responses: (Response | Error)[]) {
  const requests: { method: string; url: URL; auth: string | null; body: unknown }[] = [];
  const fetch = async (request: Request) => {
    const text = await request.text();
    requests.push({
      method: request.method,
      url: new URL(request.url),
      auth: request.headers.get('authorization'),
      body: text ? JSON.parse(text) : undefined,
    });
    const next = responses.shift();
    if (next === undefined) throw new Error(`Unexpected request ${request.method} ${request.url}`);
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetch, requests };
}

const clients: Client[] = [];

async function connect(project: string | null, api: ReturnType<typeof fakeApi>) {
  const server = createServer({
    api: createApiClient({ baseUrl: API_URL, apiKey: KEY, fetch: api.fetch }),
    project,
  });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'unit-tests', version: '0.0.0' });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  clients.push(client);
  return client;
}

const call = async (client: Client, name: string, args: Record<string, unknown> = {}) =>
  (await client.callTool({ name, arguments: args })) as CallToolResult;

const text = (result: CallToolResult) =>
  result.content.map((part) => (part.type === 'text' ? part.text : '')).join('\n');

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe('MCP server', () => {
  it('exposes the memory tools with honest hints and usage instructions', async () => {
    const client = await connect(PROJECT, fakeApi());
    const { tools } = await client.listTools();
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));

    expect(Object.keys(byName).sort()).toEqual([
      'delete_memory',
      'get_memory',
      'memory_index',
      'save_memory',
      'update_memory',
    ]);
    expect(byName.memory_index?.annotations?.readOnlyHint).toBe(true);
    expect(byName.get_memory?.annotations?.readOnlyHint).toBe(true);
    expect(byName.delete_memory?.annotations?.destructiveHint).toBe(true);
    expect(byName.save_memory?.annotations?.readOnlyHint).toBe(false);
    expect(client.getInstructions()).toMatch(/memory_index/);
    expect(client.getInstructions()).toMatch(/Never save secrets/);
  });

  describe('memory_index', () => {
    it('lists the project plus global memories, authenticated with the API key', async () => {
      const api = fakeApi(
        page([
          memory(),
          memory({ id: 'g-1', project: null, type: 'user', name: 'prefers-concise' }),
        ]),
      );
      const client = await connect(PROJECT, api);

      const result = await call(client, 'memory_index');

      expect(api.requests).toHaveLength(1);
      const [request] = api.requests;
      expect(request?.method).toBe('GET');
      expect(request?.auth).toBe(`Bearer ${KEY}`);
      expect(Object.fromEntries(request?.url.searchParams ?? [])).toEqual({
        project: PROJECT,
        includeGlobal: 'true',
        limit: '100',
        offset: '0',
      });
      expect(text(result)).toContain(`## Project ${PROJECT} (1)`);
      expect(text(result)).toContain('- [feedback] prefers-pnpm: Use pnpm, never npm');
      expect(text(result)).toContain('## Global (1)');
      expect(result.structuredContent).toMatchObject({
        project: PROJECT,
        memories: [{ name: 'prefers-pnpm' }, { name: 'prefers-concise', project: null }],
      });
    });

    it('follows pagination to the end', async () => {
      const first = Array.from({ length: 100 }, (_, i) => memory({ id: `m-${i}`, name: `m-${i}` }));
      const api = fakeApi(page(first, 101), page([memory({ id: 'm-100', name: 'm-100' })], 101));
      const client = await connect(PROJECT, api);

      const result = await call(client, 'memory_index');

      expect(api.requests.map((r) => r.url.searchParams.get('offset'))).toEqual(['0', '100']);
      expect((result.structuredContent as { memories: unknown[] }).memories).toHaveLength(101);
    });

    it('shows only global memories when no project is detected', async () => {
      const api = fakeApi(
        page([memory(), memory({ id: 'g-1', project: null, name: 'global-one' })]),
      );
      const client = await connect(null, api);

      const result = await call(client, 'memory_index');

      expect(api.requests[0]?.url.searchParams.has('project')).toBe(false);
      expect(text(result)).toContain('No project detected');
      expect(text(result)).not.toContain('prefers-pnpm');
      expect(text(result)).toContain('global-one');
    });

    it('passes the type filter through in global-only mode too', async () => {
      const api = fakeApi(page([memory({ id: 'g-1', project: null, type: 'user', name: 'tz' })]));
      const client = await connect(null, api);

      const result = await call(client, 'memory_index', { type: 'user' });

      expect(api.requests[0]?.url.searchParams.get('type')).toBe('user');
      expect(text(result)).toContain('[user] tz');
    });

    it('passes the type filter through', async () => {
      const api = fakeApi(page([]));
      const client = await connect(PROJECT, api);
      await call(client, 'memory_index', { type: 'reference' });
      expect(api.requests[0]?.url.searchParams.get('type')).toBe('reference');
    });
  });

  describe('save_memory', () => {
    const input = {
      type: 'feedback',
      name: 'prefers-pnpm',
      description: 'Use pnpm, never npm',
      content: 'The widgets team standardized on pnpm workspaces.',
    };

    it('saves into the current project by default', async () => {
      const api = fakeApi(json(201, memory()));
      const client = await connect(PROJECT, api);

      const result = await call(client, 'save_memory', input);

      expect(api.requests[0]).toMatchObject({
        method: 'POST',
        body: { ...input, project: PROJECT },
      });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual({ memory: memory() });
      expect(text(result)).toMatch(/^Saved\./);
    });

    it('saves a global memory when asked', async () => {
      const api = fakeApi(json(201, memory({ project: null })));
      const client = await connect(PROJECT, api);
      await call(client, 'save_memory', { ...input, scope: 'global' });
      expect(api.requests[0]?.body).toMatchObject({ project: null });
    });

    it('refuses a project memory when no project is detected, without calling the API', async () => {
      const api = fakeApi();
      const client = await connect(null, api);

      const result = await call(client, 'save_memory', input);

      expect(result.isError).toBe(true);
      expect(text(result)).toMatch(/scope "global"|MINDBRIDGE_PROJECT/);
      expect(api.requests).toHaveLength(0);
    });

    it('explains how to recover from a duplicate name', async () => {
      const client = await connect(PROJECT, fakeApi(problem(409, 'CONFLICT', 'exists')));
      const result = await call(client, 'save_memory', input);
      expect(result.isError).toBe(true);
      expect(text(result)).toMatch(/memory_index.*update_memory/s);
    });

    it('relays field-level validation errors', async () => {
      const client = await connect(
        PROJECT,
        fakeApi(
          problem(400, 'VALIDATION_ERROR', 'The request is invalid.', [
            { path: 'body.name', message: 'must be kebab-case (e.g. "prefers-pnpm")' },
          ]),
        ),
      );
      const result = await call(client, 'save_memory', { ...input, name: 'Prefers PNPM' });
      expect(result.isError).toBe(true);
      expect(text(result)).toContain('- body.name: must be kebab-case');
    });
  });

  describe('get_memory, update_memory and delete_memory', () => {
    it('reads a memory in full', async () => {
      const api = fakeApi(json(200, memory()));
      const client = await connect(PROJECT, api);

      const result = await call(client, 'get_memory', { id: memory().id });

      expect(api.requests[0]?.url.pathname).toBe(`/v1/memories/${memory().id}`);
      expect(text(result)).toContain('# prefers-pnpm');
      expect(text(result)).toContain('The widgets team standardized on pnpm workspaces.');
    });

    it('patches only the given fields', async () => {
      const api = fakeApi(json(200, memory({ content: 'pnpm 12+' })));
      const client = await connect(PROJECT, api);

      const result = await call(client, 'update_memory', { id: memory().id, content: 'pnpm 12+' });

      expect(api.requests[0]).toMatchObject({ method: 'PATCH', body: { content: 'pnpm 12+' } });
      expect(text(result)).toMatch(/^Updated\./);
    });

    it('deletes a memory', async () => {
      const api = fakeApi(new Response(null, { status: 204 }));
      const client = await connect(PROJECT, api);

      const result = await call(client, 'delete_memory', { id: memory().id });

      expect(api.requests[0]?.method).toBe('DELETE');
      expect(text(result)).toBe(`Deleted memory ${memory().id}.`);
    });

    it('points to memory_index when an id is unknown', async () => {
      const client = await connect(PROJECT, fakeApi(problem(404, 'NOT_FOUND', 'gone')));
      const result = await call(client, 'get_memory', { id: 'missing' });
      expect(result.isError).toBe(true);
      expect(text(result)).toMatch(/memory_index/);
    });
  });

  describe('API failures', () => {
    it('tells the user to check the key on 401', async () => {
      const client = await connect(PROJECT, fakeApi(problem(401, 'UNAUTHORIZED', 'nope')));
      const result = await call(client, 'memory_index');
      expect(result.isError).toBe(true);
      expect(text(result)).toMatch(/MINDBRIDGE_API_KEY/);
    });

    it('copes with non-problem error bodies, e.g. a proxy 502 page', async () => {
      const proxyPage = new Response('<html>Bad Gateway</html>', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'content-type': 'text/html' },
      });
      const client = await connect(PROJECT, fakeApi(proxyPage));

      const result = await call(client, 'memory_index');

      expect(result.isError).toBe(true);
      expect(text(result)).toContain('Bad Gateway');
    });

    it('does not disguise unexpected errors as API errors', async () => {
      const real = createApiClient({ baseUrl: API_URL, apiKey: KEY, fetch: fakeApi().fetch });
      const server = createServer({
        api: { ...real, listAll: () => Promise.reject(new Error('bug in the client')) },
        project: PROJECT,
      });
      const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
      const client = new Client({ name: 'unit-tests', version: '0.0.0' });
      await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
      clients.push(client);

      const result = await call(client, 'memory_index');

      expect(result.isError).toBe(true);
      expect(text(result)).toContain('bug in the client');
      expect(text(result)).not.toContain('MINDBRIDGE_API_KEY');
    });

    it('says where it tried to connect when the API is down', async () => {
      const client = await connect(PROJECT, fakeApi(new TypeError('fetch failed')));
      const result = await call(client, 'memory_index');
      expect(result.isError).toBe(true);
      expect(text(result)).toContain(API_URL);
      expect(text(result)).toContain('Is the Mindbridge API running?');
    });
  });
});
