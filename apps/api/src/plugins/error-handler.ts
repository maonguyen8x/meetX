import type { FastifyInstance } from 'fastify';

import { AppError } from '../utils/errors.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.httpStatus).send({
        error: { code: error.code, message: error.message },
      });
    }

    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 429) {
      return reply
        .status(429)
        .send({ error: { code: 'RATE_LIMITED', message: 'Too many requests.' } });
    }
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return reply
        .status(statusCode)
        .send({ error: { code: 'BAD_REQUEST', message: 'The request is invalid.' } });
    }

    request.log.error({ err: error }, 'Unhandled request error');
    return reply.status(500).send({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
    });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }),
  );
}
