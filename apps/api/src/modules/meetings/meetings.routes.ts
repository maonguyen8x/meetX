import type { FastifyInstance } from 'fastify';
import {
  exportMeetingQuerySchema,
  listMeetingsQuerySchema,
  meetingIdParamSchema,
} from '@meetx/shared/schemas/meeting';

import { requireAuthenticated } from '../../authorization/guards.js';
import { requireActor } from '../../plugins/auth.js';
import { parse } from '../../utils/validate.js';
import type { createMeetingsService } from './meetings.service.js';

type MeetingsService = ReturnType<typeof createMeetingsService>;

export function registerMeetingRoutes(app: FastifyInstance, service: MeetingsService): void {
  app.get(
    '/v1/meetings',
    {
      preHandler: requireAuthenticated,
      schema: { tags: ['Meetings'], summary: 'List accessible meeting history' },
    },
    async (request) =>
      service.list(
        requireActor(request),
        parse(listMeetingsQuerySchema, request.query),
      ),
  );

  app.get<{ Params: { id: string } }>(
    '/v1/meetings/:id/export',
    {
      preHandler: requireAuthenticated,
      schema: { tags: ['Meetings'], summary: 'Export a meeting as Markdown or JSON' },
    },
    async (request, reply) => {
      const { id } = parse(meetingIdParamSchema, request.params);
      const query = parse(exportMeetingQuerySchema, request.query);
      const file = await service.exportMeeting(requireActor(request), id, query.format);
      return reply
        .type(file.contentType)
        .header('Content-Disposition', `attachment; filename="${file.filename}"`)
        .send(file.body);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/v1/meetings/:id',
    {
      preHandler: requireAuthenticated,
      schema: { tags: ['Meetings'], summary: 'Get meeting details and decrypted transcript' },
    },
    async (request) => {
      const { id } = parse(meetingIdParamSchema, request.params);
      return service.get(requireActor(request), id);
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/v1/meetings/:id',
    {
      preHandler: requireAuthenticated,
      schema: { tags: ['Meetings'], summary: 'Delete meeting history' },
    },
    async (request, reply) => {
      const { id } = parse(meetingIdParamSchema, request.params);
      await service.remove(requireActor(request), id);
      return reply.status(204).send();
    },
  );
}
