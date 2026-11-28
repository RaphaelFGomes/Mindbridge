import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Database } from './db/client.js';
import { registerErrorHandling } from './errors.js';
import { trackAllowedMethods } from './method-not-allowed.js';
import { registerSecurityHeaders } from './security-headers.js';
import { ApiKeyRepository, type ApiKeyStore } from './modules/api-keys/api-key.repository.js';
import { requireApiKey } from './modules/api-keys/auth.js';
import { MemoryRepository } from './modules/memories/memory.repository.js';
import { memoryRoutes } from './modules/memories/memory.routes.js';
import { healthRoutes } from './routes/health.js';
import { API_VERSION } from './version.js';

export interface AppOptions {
  db: Database;
  logger?: FastifyServerOptions['logger'];
  /** Defaults to API keys stored in `db`. */
  apiKeys?: ApiKeyStore;
}

export async function buildApp({
  db,
  // Stryker disable next-line BooleanLiteral: logging only.
  logger = false,
  apiKeys = new ApiKeyRepository(db),
}: AppOptions) {
  // No implicit HEAD routes: the API serves exactly the methods it documents.
  const app = Fastify({ logger, exposeHeadRoutes: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandling(app);
  registerSecurityHeaders(app);
  // Stryker disable next-line StringLiteral,CallExpression: only shapes request objects (V8 performance); the hook assigns the property either way.
  app.decorateRequest('apiKey', null);
  const registerMethodNotAllowed = trackAllowedMethods(app);

  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Mindbridge API',
        description: 'Vendor-agnostic shared memory for AI assistants.',
        version: API_VERSION,
        license: { name: 'MIT', identifier: 'MIT' },
      },
      tags: [
        { name: 'memories', description: 'Typed, one-fact-per-entry memories' },
        { name: 'health', description: 'Service health' },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'http',
            scheme: 'bearer',
            description: 'Mindbridge API key (`mb_…`). Create one with `pnpm keys:create`.',
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });
  // staticCSP: Swagger UI sends its own CSP (with hashes for its inline code).
  await app.register(fastifySwaggerUi, { routePrefix: '/docs', staticCSP: true });
  app.get('/openapi.json', { schema: { hide: true } }, () => app.swagger());

  await app.register(healthRoutes, { db });
  // Everything under /v1 requires an API key; health and docs stay public.
  await app.register(
    async (v1) => {
      v1.addHook('onRequest', requireApiKey(apiKeys));
      await v1.register(memoryRoutes, { repository: new MemoryRepository(db) });
    },
    { prefix: '/v1' },
  );
  registerMethodNotAllowed();

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
