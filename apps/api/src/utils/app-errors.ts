import { Prisma } from '@prisma/client';

import { AppError } from './errors.js';

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function forbidden(message = 'You do not have permission to perform this action.'): AppError {
  return new AppError('FORBIDDEN', message, 403);
}

export function notFound(message = 'Resource not found.'): AppError {
  return new AppError('NOT_FOUND', message, 404);
}
