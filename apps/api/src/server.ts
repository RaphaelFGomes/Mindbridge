import type { FastifyServerOptions } from 'fastify';
import { buildApp } from './app.js';
import { loadConfig, type Config } from './config.js';
import { createDatabase } from './db/client.js';

function loggerOptions(config: Config): FastifyServerOptions['logger'] {
  if (config.NODE_ENV === 'development' && process.stdout.isTTY) {
    return { level: config.LOG_LEVEL, transport: { target: 'pino-pretty' } };
  }
  return { level: config.LOG_LEVEL };
}

const config = loadConfig();
const { db, close } = createDatabase(config.DATABASE_URL);
const app = await buildApp({ db, logger: loggerOptions(config) });
app.addHook('onClose', close);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'Shutting down');
    app.close().then(
      () => process.exit(0),
      (error: unknown) => {
        app.log.error({ err: error }, 'Error during shutdown');
        process.exit(1);
      },
    );
  });
}

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.fatal({ err: error }, 'Failed to start');
  await app.close();
  process.exit(1);
}
