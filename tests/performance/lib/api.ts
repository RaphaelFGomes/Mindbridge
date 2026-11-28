import { check } from 'k6';
import http, { type Response } from 'k6/http';
import { API_KEY, API_URL } from './config.ts';

export interface Memory {
  id: string;
  project: string | null;
  type: string;
  name: string;
}

interface MemoryList {
  items: Memory[];
  total: number;
}

/** Splits latency thresholds: `setup` keeps the seeding out of the read and write numbers. */
export type Op = 'read' | 'write' | 'setup';

/**
 * `name` groups URLs that carry an id into one metric instead of one per memory.
 * The JSON content type goes only on requests with a body: Fastify rejects an
 * empty body declared as JSON.
 */
function params(op: Op, name: string, json = false) {
  return {
    headers: {
      authorization: `Bearer ${API_KEY}`,
      ...(json && { 'content-type': 'application/json' }),
    },
    tags: { op, name },
  };
}

const expectStatus = (response: Response, label: string, status: number) =>
  check(response, { [`${label}: ${status}`]: (r) => r.status === status });

const query = (values: Record<string, string | number>) =>
  Object.entries(values)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

export function listMemories(
  name: string,
  values: Record<string, string | number>,
): MemoryList | null {
  const response = http.get(`${API_URL}/v1/memories?${query(values)}`, params('read', name));
  return expectStatus(response, name, 200) ? (response.json() as unknown as MemoryList) : null;
}

export function getMemory(id: string): void {
  expectStatus(http.get(`${API_URL}/v1/memories/${id}`, params('read', 'get')), 'get', 200);
}

export function createMemory(body: Record<string, unknown>, op: Op = 'write'): Memory | null {
  const response = http.post(
    `${API_URL}/v1/memories`,
    JSON.stringify(body),
    params(op, 'create', true),
  );
  return expectStatus(response, 'create', 201) ? (response.json() as unknown as Memory) : null;
}

export function updateMemory(id: string, body: Record<string, unknown>): void {
  const response = http.patch(
    `${API_URL}/v1/memories/${id}`,
    JSON.stringify(body),
    params('write', 'update', true),
  );
  expectStatus(response, 'update', 200);
}

export function deleteMemory(id: string, op: Op = 'write'): void {
  expectStatus(http.del(`${API_URL}/v1/memories/${id}`, null, params(op, 'delete')), 'delete', 204);
}
