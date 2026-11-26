import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { MindbridgeApiError, type ApiClient, type Memory } from '@mindbridge/api-client';
import { renderIndex, renderMemory } from './format.js';

export const SERVER_VERSION = '0.2.0';

const MEMORY_TYPES = ['user', 'feedback', 'project', 'reference'] as const;

const memorySchema = z.object({
  id: z.string(),
  project: z.string().nullable(),
  type: z.enum(MEMORY_TYPES),
  name: z.string(),
  description: z.string(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Compile-time contract check: the output schema must match the type generated
// from the API's OpenAPI document. Regenerating after an API change breaks the
// build here instead of breaking assistants at runtime.
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type MemorySchemaMatchesContract = Assert<
  MutuallyAssignable<z.infer<typeof memorySchema>, Memory>
>;

const indexEntrySchema = memorySchema.pick({
  id: true,
  project: true,
  type: true,
  name: true,
  description: true,
});

const memoryTypeInput = z
  .enum(MEMORY_TYPES)
  .describe(
    'user: who the user is · feedback: how to work with them · project: goals, decisions, constraints · reference: pointers to external resources',
  );
const nameInput = z
  .string()
  .describe('kebab-case slug, unique within its scope, e.g. "prefers-pnpm"');
const descriptionInput = z
  .string()
  .describe('one line (max 200 chars) used to decide relevance from the index');
const contentInput = z.string().describe('the fact itself, in markdown (max 10,000 chars)');
const idInput = z.string().describe('memory id, as shown by memory_index');

const INSTRUCTIONS = `Mindbridge is the user's memory shared across AI assistants (Claude, Copilot, Cursor, ChatGPT...).
- At the start of a session, call memory_index, then get_memory for the entries that matter to the task.
- Save durable knowledge with save_memory: who the user is, how they want you to work, project decisions and constraints, pointers to resources. One fact per memory.
- Prefer update_memory over saving a near-duplicate. Delete memories that turn out to be wrong.
- Never save secrets (API keys, passwords, tokens) or data the user would not want shared with other assistants.`;

export interface ServerOptions {
  api: ApiClient;
  /** Project key detected from git (or MINDBRIDGE_PROJECT); null means global memories only. */
  project: string | null;
}

const ok = (text: string, structuredContent?: Record<string, unknown>): CallToolResult => ({
  content: [{ type: 'text', text }],
  ...(structuredContent && { structuredContent }),
});

/** Turns API failures into tool errors the assistant can act on. */
function toolError(error: unknown): CallToolResult {
  if (!(error instanceof MindbridgeApiError)) throw error;

  const hints: Record<number, string> = {
    401: 'The Mindbridge API rejected the API key. Check MINDBRIDGE_API_KEY; revoked keys stop working immediately.',
    404: 'No memory with this id. Call memory_index to see the current ids.',
    409: 'A memory with this name already exists in this scope. Call memory_index to find its id, then use update_memory.',
  };
  const lines = [
    (error.status !== null ? hints[error.status] : undefined) ?? error.message,
    ...error.fieldErrors.map((field) => `- ${field.path}: ${field.message}`),
  ];
  // Behind a proxy or gateway, a stopped API shows up as 502/503/504 rather than a refused connection.
  // (A null status means there was no HTTP response at all.)
  const unavailable = error.status === null || [502, 503, 504].includes(error.status);
  if (unavailable) lines.push('Is the Mindbridge API running?');
  return { isError: true, content: [{ type: 'text', text: lines.join('\n') }] };
}

async function attempt(run: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await run();
  } catch (error) {
    return toolError(error);
  }
}

export function createServer({ api, project }: ServerOptions): McpServer {
  const server = new McpServer(
    { name: 'mindbridge', version: SERVER_VERSION },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    'memory_index',
    {
      title: 'Memory index',
      description:
        'List the memories available here: this project plus global ones, one line each (type, name, description, id). Call this first in a session.',
      inputSchema: { type: memoryTypeInput.optional() },
      outputSchema: { project: z.string().nullable(), memories: z.array(indexEntrySchema) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ type }) =>
      attempt(async () => {
        const all =
          project === null
            ? (await api.listAll({ ...(type && { type }) })).filter(
                (memory) => memory.project === null,
              )
            : await api.listAll({ project, includeGlobal: 'true', ...(type && { type }) });
        const memories = all.map(({ id, project, type, name, description }) => ({
          id,
          project,
          type,
          name,
          description,
        }));
        return ok(renderIndex(all, project), { project, memories });
      }),
  );

  server.registerTool(
    'get_memory',
    {
      title: 'Read a memory',
      description: 'Read one memory in full.',
      inputSchema: { id: idInput },
      outputSchema: { memory: memorySchema },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ id }) =>
      attempt(async () => {
        const memory = await api.get(id);
        return ok(renderMemory(memory), { memory });
      }),
  );

  server.registerTool(
    'save_memory',
    {
      title: 'Save a memory',
      description:
        'Save one durable fact so every assistant can recall it later. Scope "project" (default) ties it to the current git repository; "global" applies everywhere (typically user and feedback memories).',
      inputSchema: {
        type: memoryTypeInput,
        name: nameInput,
        description: descriptionInput,
        content: contentInput,
        scope: z.enum(['project', 'global']).default('project'),
      },
      outputSchema: { memory: memorySchema },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    ({ scope, ...input }) =>
      attempt(async () => {
        if (scope === 'project' && project === null) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: 'No project detected (no git "origin" remote here and MINDBRIDGE_PROJECT is unset). Save with scope "global", or configure MINDBRIDGE_PROJECT.',
              },
            ],
          };
        }
        const memory = await api.create({
          ...input,
          project: scope === 'project' ? project : null,
        });
        return ok(`Saved.\n\n${renderMemory(memory)}`, { memory });
      }),
  );

  server.registerTool(
    'update_memory',
    {
      title: 'Update a memory',
      description: 'Change the type, name, description or content of an existing memory.',
      inputSchema: {
        id: idInput,
        type: memoryTypeInput.optional(),
        name: nameInput.optional(),
        description: descriptionInput.optional(),
        content: contentInput.optional(),
      },
      outputSchema: { memory: memorySchema },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ id, ...patch }) =>
      attempt(async () => {
        const memory = await api.update(id, patch);
        return ok(`Updated.\n\n${renderMemory(memory)}`, { memory });
      }),
  );

  server.registerTool(
    'delete_memory',
    {
      title: 'Delete a memory',
      description: 'Delete a memory that is wrong or no longer useful. This cannot be undone.',
      inputSchema: { id: idInput },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ id }) =>
      attempt(async () => {
        await api.remove(id);
        return ok(`Deleted memory ${id}.`);
      }),
  );

  return server;
}
