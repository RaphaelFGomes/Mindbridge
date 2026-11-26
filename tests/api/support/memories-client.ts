import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { Contract } from './contract.js';

export type MemoryType = 'user' | 'feedback' | 'project' | 'reference';

export interface Memory {
  id: string;
  project: string | null;
  type: MemoryType;
  name: string;
  description: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryList {
  items: Memory[];
  total: number;
  limit: number;
  offset: number;
}

export interface NewMemory {
  project?: string | null;
  type: MemoryType;
  name: string;
  description: string;
  content: string;
}

type Query = Record<string, string | number | boolean>;

/**
 * Thin HTTP client for /v1/memories. Every call is checked against the
 * OpenAPI contract, and created memories are deleted after the test.
 */
export class MemoriesClient {
  private readonly created = new Set<string>();

  constructor(
    private readonly request: APIRequestContext,
    private readonly contract: Contract,
  ) {}

  async create(data: object): Promise<APIResponse> {
    const response = await this.request.post('/v1/memories', { data });
    await this.contract.verify(response, 'post', '/v1/memories');
    if (response.status() === 201) this.created.add(((await response.json()) as Memory).id);
    return response;
  }

  async createOk(data: NewMemory): Promise<Memory> {
    const response = await this.create(data);
    expect(response.status(), await response.text()).toBe(201);
    return (await response.json()) as Memory;
  }

  async get(id: string): Promise<APIResponse> {
    const response = await this.request.get(`/v1/memories/${id}`);
    await this.contract.verify(response, 'get', '/v1/memories/{id}');
    return response;
  }

  async list(params: Query = {}): Promise<APIResponse> {
    const response = await this.request.get('/v1/memories', { params });
    await this.contract.verify(response, 'get', '/v1/memories');
    return response;
  }

  async listOk(params: Query = {}): Promise<MemoryList> {
    const response = await this.list(params);
    expect(response.status(), await response.text()).toBe(200);
    return (await response.json()) as MemoryList;
  }

  /** Follows pagination to the end. Use when other tests may add global memories concurrently. */
  async listAll(params: Query = {}): Promise<Memory[]> {
    const items: Memory[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = await this.listOk({ ...params, limit: 100, offset });
      items.push(...page.items);
      if (page.items.length < 100) return items;
    }
  }

  async update(id: string, data: object): Promise<APIResponse> {
    const response = await this.request.patch(`/v1/memories/${id}`, { data });
    await this.contract.verify(response, 'patch', '/v1/memories/{id}');
    return response;
  }

  async remove(id: string): Promise<APIResponse> {
    const response = await this.request.delete(`/v1/memories/${id}`);
    await this.contract.verify(response, 'delete', '/v1/memories/{id}');
    if (response.status() === 204) this.created.delete(id);
    return response;
  }

  /** Registers a memory created by other means (e.g. through MCP) for cleanup. */
  track(id: string): void {
    this.created.add(id);
  }

  /** Teardown: delete whatever the test left behind (already-deleted ids are fine). */
  async cleanup(): Promise<void> {
    await Promise.all([...this.created].map((id) => this.request.delete(`/v1/memories/${id}`)));
    this.created.clear();
  }
}
