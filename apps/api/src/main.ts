import { env } from './config/env.js';
import { postgres } from './db/postgres.js';
import { redis } from './db/redis.js';
import { buildApp } from './app.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  await redis.connect();
  const app = buildApp({
    database: async () => {
      await postgres.query('SELECT 1');
    },
    redis: async () => {
      await redis.ping();
    },
  });

  app.addHook('onClose', async () => {
    await Promise.all([postgres.end(), redis.quit()]);
  });

  await app.listen({ host: env.HOST, port: env.PORT });
  logger.info({ host: env.HOST, port: env.PORT }, 'API server listening');
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start API server');
  process.exitCode = 1;
});
