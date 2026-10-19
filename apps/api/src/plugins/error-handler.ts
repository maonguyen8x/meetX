import type { FastifyInstance } from 'fastify';

import { AppError } from '../utils/errors.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.httpStatus).send({
        error: { code: error.code, message: error.message },
      });
    }

    request.log.error({ err: error }, 'Unhandled request error');
    return reply.status(500).send({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
    });
  });
}
