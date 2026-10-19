import { QueueEvents } from 'bullmq';
import Redis from 'ioredis';

import { env } from './config/env.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const queueEvents = new QueueEvents('interpreter-jobs', { connection });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error({ jobId, failedReason }, 'Background job failed');
  });

  await queueEvents.waitUntilReady();
  logger.info('BullMQ event listener ready; no job processors are registered yet');

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info({ signal }, 'Shutting down worker');
    await queueEvents.close();
    await connection.quit();
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start worker');
  process.exitCode = 1;
});
