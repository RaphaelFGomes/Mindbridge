import type { FastifyInstance } from 'fastify';

/** JSON never needs to load anything or be framed. */
const API_CSP = "default-src 'none'; frame-ancestors 'none'";

/**
 * Hardening headers on every response (checked by the OWASP ZAP scan in CI).
 * They are set as defaults when the request arrives, so anything more specific
 * later in the lifecycle overrides them: Swagger UI sends its own CSP
 * (staticCSP) and caching for its static assets.
 */
export function registerSecurityHeaders(app: FastifyInstance): void {
  app.addHook('onRequest', (_request, reply, done) => {
    reply.headers({
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'cross-origin-resource-policy': 'same-origin',
      'content-security-policy': API_CSP,
      // Responses carry users' memories: never store them in shared or browser caches.
      'cache-control': 'no-store',
    });
    done();
  });
}
