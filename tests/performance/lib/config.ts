/** Where the API runs and the key to use: `k6 run -e API_URL=... -e MINDBRIDGE_API_KEY=...`. */
export const API_URL = __ENV.API_URL ?? 'http://127.0.0.1:4000';
export const API_KEY = __ENV.MINDBRIDGE_API_KEY ?? '';

export const MEMORY_TYPES = ['user', 'feedback', 'project', 'reference'] as const;
