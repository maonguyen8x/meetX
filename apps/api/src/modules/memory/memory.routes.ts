import type { FastifyInstance } from 'fastify';
import {
  createGlossaryTermSchema,
  glossaryIdParamSchema,
  listGlossaryQuerySchema,
  updateGlossaryTermSchema,
} from '@meetx/shared/schemas/meeting';

import { requireAuthenticated } from '../../authorization/guards.js';
import { requireActor } from '../../plugins/auth.js';
import { parse } from '../../utils/validate.js';
import type { createMemoryService } from './memory.service.js';

type MemoryService = ReturnType<typeof createMemoryService>;

export function registerMemoryRoutes(app: FastifyInstance, service: MemoryService): void {
  app.get(
    '/v1/glossary',
    {
      preHandler: requireAuthenticated,
      schema: { tags: ['Memory'], summary: 'List personal and accessible organization glossary terms' },
    },
    async (request) =>
      service.list(requireActor(request), parse(listGlossaryQuerySchema, request.query)),
  );

  app.post(
    '/v1/glossary',
    {
      preHandler: requireAuthenticated,
      schema: { tags: ['Memory'], summary: 'Create a glossary term' },
    },
    async (request, reply) => {
      const term = await service.create(
        requireActor(request),
        parse(createGlossaryTermSchema, request.body),
      );
      return reply.status(201).send(term);
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/v1/glossary/:id',
    {
      preHandler: requireAuthenticated,
      schema: { tags: ['Memory'], summary: 'Update a glossary term' },
    },
    async (request) => {
      const { id } = parse(glossaryIdParamSchema, request.params);
      return service.update(
        requireActor(request),
        id,
        parse(updateGlossaryTermSchema, request.body),
      );
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/v1/glossary/:id',
    {
      preHandler: requireAuthenticated,
      schema: { tags: ['Memory'], summary: 'Delete a glossary term' },
    },
    async (request, reply) => {
      const { id } = parse(glossaryIdParamSchema, request.params);
      await service.remove(requireActor(request), id);
      return reply.status(204).send();
    },
  );
}
