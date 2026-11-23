import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { problem } from './errors.js';

/**
 * Answers undeclared methods on documented paths with 405 + `Allow` (RFC 9110),
 * instead of a misleading 404.
 *
 * Call before registering routes; call the returned function after all routes
 * are registered.
 */
export function trackAllowedMethods(app: FastifyInstance): () => void {
  const allowed = new Map<string, Set<string>>();

  app.addHook('onRoute', (route) => {
    if (route.schema?.hide) return;
    const methods = allowed.get(route.url) ?? new Set<string>();
    for (const method of [route.method].flat()) methods.add(method);
    allowed.set(route.url, methods);
  });

  return () => {
    for (const [url, methods] of allowed) {
      const allow = [...methods].sort().join(', ');
      const reject = async (request: FastifyRequest, reply: FastifyReply) => {
        await reply
          .code(405)
          .header('allow', allow)
          .type('application/problem+json')
          .send(
            problem(
              405,
              'METHOD_NOT_ALLOWED',
              `${request.method} is not supported on ${url}. Allowed: ${allow}.`,
            ),
          );
      };

      app.route({
        // Every method Fastify can route (incl. TRACE and QUERY) that the path doesn't declare.
        method: app.supportedMethods.filter((method) => !methods.has(method)),
        url,
        schema: { hide: true },
        // Answer in onRequest, before Fastify looks at the body: otherwise a QUERY
        // without Content-Type or a malformed JSON body would get a 400 instead.
        onRequest: reject,
        handler: reject,
      });
    }
  };
}
