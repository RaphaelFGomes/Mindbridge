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
import { MemoryRepository } from './modules/memories/memory.repository.js';
import { memoryRoutes } from './modules/memories/memory.routes.js';
import { healthRoutes } from './routes/health.js';
import { API_VERSION } from './version.js';

export interface AppOptions {
  db: Database;
  logger?: FastifyServerOptions['logger'];
}

export async function buildApp({ db, logger = false }: AppOptions) {
  // No implicit HEAD routes: the API serves exactly the methods it documents.
  const app = Fastify({ logger, exposeHeadRoutes: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandling(app);
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
    },
    transform: jsonSchemaTransform,
  });
  await app.register(fastifySwaggerUi, { routePrefix: '/docs' });
  app.get('/openapi.json', { schema: { hide: true } }, () => app.swagger());

  await app.register(healthRoutes, { db });
  await app.register(memoryRoutes, { prefix: '/v1', repository: new MemoryRepository(db) });
  registerMethodNotAllowed();

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
