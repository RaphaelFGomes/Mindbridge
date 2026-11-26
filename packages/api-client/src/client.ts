import createClient from 'openapi-fetch';
import type { paths } from './generated/api.js';

// Types come from the API's OpenAPI document (see `pnpm generate:api`).
type MemoriesPath = paths['/v1/memories'];
type MemoryPath = paths['/v1/memories/{id}'];

export type Memory = MemoryPath['get']['responses'][200]['content']['application/json'];
export type MemoryType = Memory['type'];
export type NewMemory = NonNullable<
  MemoriesPath['post']['requestBody']
>['content']['application/json'];
export type MemoryPatch = NonNullable<
  MemoryPath['patch']['requestBody']
>['content']['application/json'];
export type ListQuery = NonNullable<MemoriesPath['get']['parameters']['query']>;
export type MemoryList = MemoriesPath['get']['responses'][200]['content']['application/json'];

interface Problem {
  status?: number;
  code?: string;
  detail?: string;
  errors?: { path: string; message: string }[];
}

/** Any failure talking to the API, with what the assistant needs to recover. */
export class MindbridgeApiError extends Error {
  override name = 'MindbridgeApiError';

  constructor(
    readonly status: number | null,
    readonly code: string,
    message: string,
    readonly fieldErrors: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  apiKey: string;
  /** For tests. Defaults to the global fetch. */
  fetch?: (request: Request) => Promise<Response>;
}

const PAGE_SIZE = 100;

export function createApiClient({ baseUrl, apiKey, fetch }: ApiClientOptions) {
  const client = createClient<paths>({
    baseUrl,
    headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json' },
    ...(fetch && { fetch }),
  });

  /** Runs a request, turning network failures and problem responses into MindbridgeApiError. */
  async function call<T>(
    request: () => Promise<{ data?: T; error?: unknown; response: Response }>,
  ): Promise<T> {
    let result: Awaited<ReturnType<typeof request>>;
    try {
      result = await request();
    } catch (error) {
      throw new MindbridgeApiError(
        null,
        'API_UNREACHABLE',
        `Cannot reach the Mindbridge API at ${baseUrl}: ${(error as Error).message}`,
      );
    }
    const { data, error, response } = result;
    if (error !== undefined || !response.ok) {
      const problem = (error ?? {}) as Problem;
      throw new MindbridgeApiError(
        response.status,
        problem.code ?? `HTTP_${response.status}`,
        problem.detail ?? response.statusText,
        problem.errors,
      );
    }
    return data as T;
  }

  /** One page, with the total across all pages. */
  const list = (query: ListQuery): Promise<MemoryList> =>
    call(() => client.GET('/v1/memories', { params: { query } }));

  return {
    baseUrl,

    list,

    /** Every page, for callers that need the full set (e.g. the MCP index). */
    async listAll(query: Omit<ListQuery, 'limit' | 'offset'>): Promise<Memory[]> {
      const items: Memory[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const page = await list({ ...query, limit: PAGE_SIZE, offset });
        items.push(...page.items);
        if (page.items.length < PAGE_SIZE) return items;
      }
    },

    get: (id: string) => call(() => client.GET('/v1/memories/{id}', { params: { path: { id } } })),

    create: (body: NewMemory) => call(() => client.POST('/v1/memories', { body })),

    update: (id: string, body: MemoryPatch) =>
      call(() => client.PATCH('/v1/memories/{id}', { params: { path: { id } }, body })),

    remove: async (id: string): Promise<void> => {
      await call(() => client.DELETE('/v1/memories/{id}', { params: { path: { id } } }));
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
