import { z } from 'zod';

import { AppError } from './errors.js';

export const uuidSchema = z.string().uuid();

export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    throw new AppError(
      'VALIDATION_ERROR',
      path ? `${path}: ${issue?.message ?? 'Invalid value.'}` : (issue?.message ?? 'Invalid input.'),
      400,
    );
  }
  return result.data as z.output<S>;
}
