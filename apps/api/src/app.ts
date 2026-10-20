import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
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
import { createMeetingsRepository } from './modules/meetings/meetings.repository.js';
import { createMeetingsService } from './modules/meetings/meetings.service.js';
import { registerMeetingRoutes } from './modules/meetings/meetings.routes.js';
import { createGlossaryRepository } from './modules/memory/glossary.repository.js';
import { createMemoryService } from './modules/memory/memory.service.js';
import { registerMemoryRoutes } from './modules/memory/memory.routes.js';
import { LocalAvatarStorage } from './modules/settings/avatar-storage.js';
import type { AvatarStorage } from './modules/settings/avatar-storage.js';
import { createSettingsRepository } from './modules/settings/settings.repository.js';
import { createSettingsService } from './modules/settings/settings.service.js';
import { registerSettingsRoutes } from './modules/settings/settings.routes.js';
import { registerUserRoutes } from './modules/users/users.routes.js';
import { authenticateRequest, registerAuthPlugin } from './plugins/auth.js';
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
  avatarStorage?: AvatarStorage;
  dataEncryptionKey?: string;
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
  void app.register(multipart, {
    limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 },
  });
  void app.register(swagger, {
    openapi: {
      info: { title: 'Interpreter AI API', version: '1.0.0' },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'Settings', description: 'Interpreter persona and voice settings' },
        { name: 'Meetings', description: 'Meeting history, transcript, and export' },
        { name: 'Memory', description: 'Personal and organization glossary' },
      ],
    },
  });
  void app.register(swaggerUi, { routePrefix: '/docs' });
  if (options.rateLimit ?? false) {
    void app.register(rateLimit, {
      global: true,
      max: 300,
      timeWindow: '1 minute',
      ...(options.redis ? { redis: options.redis } : {}),
    });
  }
  void registerAuthPlugin(app);
  app.addHook('onRequest', async (request) => {
    if (request.url === '/docs' || request.url.startsWith('/docs/')) {
      await authenticateRequest(request);
    }
  });

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
  registerSettingsRoutes(
    app,
    createSettingsService(
      createSettingsRepository(),
      options.avatarStorage ?? new LocalAvatarStorage(),
    ),
  );
  registerMeetingRoutes(
    app,
    createMeetingsService(createMeetingsRepository(), options.dataEncryptionKey),
  );
  registerMemoryRoutes(app, createMemoryService(createGlossaryRepository()));

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
