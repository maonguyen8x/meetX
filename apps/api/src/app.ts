import Fastify from 'fastify';

import { env } from './config/env.js';
import { registerErrorHandler } from './plugins/error-handler.js';

export interface ReadinessChecks {
  database: () => Promise<void>;
  redis: () => Promise<void>;
}

export function buildApp(readinessChecks: ReadinessChecks) {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    trustProxy: env.NODE_ENV === 'production',
  });

  registerErrorHandler(app);

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ready', async (_request, reply) => {
    const [databaseResult, redisResult] = await Promise.allSettled([
      readinessChecks.database(),
      readinessChecks.redis(),
    ]);
    const dependencies = {
      database: databaseResult.status === 'fulfilled' ? 'ok' : 'unavailable',
      redis: redisResult.status === 'fulfilled' ? 'ok' : 'unavailable',
    };

    if (databaseResult.status === 'rejected') {
      app.log.error({ err: databaseResult.reason }, 'Database readiness check failed');
    }
    if (redisResult.status === 'rejected') {
      app.log.error({ err: redisResult.reason }, 'Redis readiness check failed');
    }

    const ready = dependencies.database === 'ok' && dependencies.redis === 'ok';
    return reply.status(ready ? 200 : 503).send({
      status: ready ? 'ok' : 'not_ready',
      dependencies,
    });
  });

  return app;
}
