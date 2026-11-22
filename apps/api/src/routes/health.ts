import { sql } from 'drizzle-orm';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Database } from '../db/client.js';

const healthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  checks: z.object({ database: z.enum(['up', 'down']) }),
});

export interface HealthRoutesOptions {
  db: Database;
}

export const healthRoutes: FastifyPluginCallbackZod<HealthRoutesOptions> = (app, { db }, done) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Liveness and dependency health',
        response: { 200: healthSchema, 503: healthSchema },
      },
    },
    async (request, reply) => {
      let database: 'up' | 'down' = 'up';
      try {
        await db.execute(sql`select 1`);
      } catch (error) {
        request.log.warn({ err: error }, 'Database health check failed');
        database = 'down';
      }

      const healthy = database === 'up';
      return reply
        .code(healthy ? 200 : 503)
        .send({ status: healthy ? 'ok' : 'degraded', checks: { database } });
    },
  );

  done();
};
