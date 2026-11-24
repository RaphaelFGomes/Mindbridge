import type { onRequestAsyncHookHandler } from 'fastify';
import { unauthorized } from '../../errors.js';
import { isWellFormedApiKey, parseBearerToken } from './api-key.js';
import type { ApiKeyStore, AuthenticatedKey } from './api-key.repository.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `requireApiKey` on authenticated routes. */
    apiKey: AuthenticatedKey | null;
  }
}

/**
 * Rejects requests without a valid, unrevoked API key. Runs in onRequest, so an
 * unauthenticated caller learns nothing from body or query validation.
 */
export function requireApiKey(store: ApiKeyStore): onRequestAsyncHookHandler {
  return async (request) => {
    const token = parseBearerToken(request.headers.authorization);
    // Malformed tokens are rejected without a database round trip.
    const key =
      token !== null && isWellFormedApiKey(token) ? await store.authenticate(token) : null;
    if (!key) throw unauthorized();
    request.apiKey = key;
  };
}
