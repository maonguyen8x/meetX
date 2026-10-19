import { PrismaClient } from '@prisma/client';

import { logger } from '../utils/logger.js';

export const prisma = new PrismaClient({
  log: [{ emit: 'event', level: 'error' }],
});

prisma.$on('error', (event) => {
  logger.error({ err: event }, 'Prisma client error');
});
