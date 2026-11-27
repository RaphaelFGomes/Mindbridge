import type { FastifyInstance } from 'fastify';

/** JSON never needs to load anything or be framed. */
const API_CSP = "default-src 'none'; frame-ancestors 'none'";

/**
 * Hardening headers on every response (checked by the OWASP ZAP scan in CI).
 * Routes that set their own policy or caching keep it: Swagger UI under /docs
 * ships its own CSP (staticCSP) and caches its static assets.
 */
export function registerSecurityHeaders(app: FastifyInstance): void {
  app.addHook('onSend', (_request, reply, payload, done) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('cross-origin-resource-policy', 'same-origin');
    if (!reply.hasHeader('content-security-policy')) {
      reply.header('content-security-policy', API_CSP);
    }
    // Responses carry users' memories: never store them in shared or browser caches.
    if (!reply.hasHeader('cache-control')) reply.header('cache-control', 'no-store');
    done(null, payload);
  });
}
