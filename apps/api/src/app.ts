import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import type { Redis } from 'ioredis';

import { env } from './config/env.js';
import { createAdminUsersService } from './modules/admin/admin-users.service.js';
import { registerAdminRoutes } from './modules/admin/admin.routes.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { MemoryLoginThrottle, RedisLoginThrottle } from './modules/auth/login-throttle.js';
import type { LoginThrottle } from './modules/auth/login-throttle.js';
import { createOrganizationsService } from './modules/organizations/organizations.service.js';
import { registerOrganizationRoutes } from './modules/organizations/organizations.routes.js';
import { registerUserRoutes } from './modules/users/users.routes.js';
import { registerAuthPlugin } from './plugins/auth.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { createEmailProvider } from './providers/email/index.js';
import type { EmailProvider } from './providers/email/email.provider.js';

export interface ReadinessChecks {
  database: () => Promise<void>;
  redis: () => Promise<void>;
}

export interface AppOptions {
  /** Redis client used for rate limiting and login throttling; omitted in unit tests. */
  redis?: Redis;
  rateLimit?: boolean;
  throttle?: LoginThrottle;
  mailer?: EmailProvider;
}

export function buildApp(readinessChecks: ReadinessChecks, options: AppOptions = {}) {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    trustProxy: env.NODE_ENV === 'production',
  });

  registerErrorHandler(app);

  void app.register(helmet);
  void app.register(cors, {
    origin: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
    credentials: true,
  });
  if (options.rateLimit ?? false) {
    void app.register(rateLimit, {
      global: true,
      max: 300,
      timeWindow: '1 minute',
      ...(options.redis ? { redis: options.redis } : {}),
    });
  }
  void registerAuthPlugin(app);

  const mailer = options.mailer ?? createEmailProvider();
  const throttle =
    options.throttle ?? (options.redis ? new RedisLoginThrottle(options.redis) : new MemoryLoginThrottle());
  const auth = createAuthService({
    mailer,
    throttle,
    signAccessToken: (payload) => app.jwt.sign(payload),
  });
  registerAuthRoutes(app, auth);
  registerUserRoutes(app);
  registerAdminRoutes(app, createAdminUsersService(auth));
  registerOrganizationRoutes(app, createOrganizationsService({ auth, mailer }));

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
