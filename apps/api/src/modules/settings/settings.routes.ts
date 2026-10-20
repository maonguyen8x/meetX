import type { FastifyInstance } from 'fastify';
import type { SettingsPatch } from '@meetx/shared/schemas/settings';
import { settingsPatchSchema, voicePreviewSchema } from '@meetx/shared/schemas/settings';

import { requireAuthenticated } from '../../authorization/guards.js';
import { requireActor } from '../../plugins/auth.js';
import { AppError } from '../../utils/errors.js';
import { parse } from '../../utils/validate.js';
import type { createSettingsService } from './settings.service.js';

type SettingsService = ReturnType<typeof createSettingsService>;

export function registerSettingsRoutes(app: FastifyInstance, service: SettingsService): void {
  app.get(
    '/v1/settings',
    {
      preHandler: requireAuthenticated,
      schema: { tags: ['Settings'], summary: 'Get interpreter settings' },
    },
    async (request) => service.get(requireActor(request).id),
  );

  app.patch<{ Body: SettingsPatch }>(
    '/v1/settings',
    {
      preHandler: requireAuthenticated,
      schema: { tags: ['Settings'], summary: 'Update interpreter settings' },
    },
    async (request) =>
      service.update(requireActor(request).id, parse(settingsPatchSchema, request.body)),
  );

  app.post(
    '/v1/settings/avatar',
    {
      preHandler: requireAuthenticated,
      schema: { tags: ['Settings'], summary: 'Upload a re-encoded profile avatar' },
    },
    async (request) => {
      const file = await request.file();
      if (!file) {
        throw new AppError('AVATAR_REQUIRED', 'Select an image to upload.', 400);
      }
      let buffer: Buffer;
      try {
        buffer = await file.toBuffer();
      } catch (error) {
        const statusCode =
          typeof error === 'object' && error !== null && 'statusCode' in error
            ? error.statusCode
            : undefined;
        if (statusCode === 413) {
          throw new AppError('UPLOAD_TOO_LARGE', 'Avatar images must be 2 MB or smaller.', 413);
        }
        throw error;
      }
      return service.uploadAvatar(requireActor(request).id, { buffer });
    },
  );

  app.get<{ Params: { filename: string } }>(
    '/v1/settings/avatar/:filename',
    {
      preHandler: requireAuthenticated,
      schema: { tags: ['Settings'], summary: 'Read your profile avatar' },
    },
    async (request, reply) => {
      if (!/^[a-f0-9]{48}\.webp$/.test(request.params.filename)) {
        throw new AppError('NOT_FOUND', 'Avatar not found.', 404);
      }
      const buffer = await service.getAvatar(requireActor(request).id, request.params.filename);
      return reply
        .type('image/webp')
        .header('Cache-Control', 'private, max-age=300')
        .send(buffer);
    },
  );

  app.post(
    '/v1/settings/voice-preview',
    {
      preHandler: requireAuthenticated,
      schema: { tags: ['Settings'], summary: 'Preview an interpreter voice' },
    },
    async (request) => {
      parse(voicePreviewSchema, request.body);
      throw new AppError(
        'VOICE_PREVIEW_UNAVAILABLE',
        'Voice preview is unavailable until a speech provider is configured.',
        503,
      );
    },
  );
}
