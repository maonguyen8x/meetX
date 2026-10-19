import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ConsoleEmailProvider } from './console.provider.js';
import type { EmailProvider } from './email.provider.js';
import { SmtpEmailProvider } from './smtp.provider.js';

export type { EmailMessage, EmailProvider } from './email.provider.js';

export function createEmailProvider(): EmailProvider {
  if (env.EMAIL_PROVIDER === 'smtp') {
    if (!env.SMTP_HOST) throw new Error('SMTP_HOST is required when EMAIL_PROVIDER=smtp.');
    return new SmtpEmailProvider({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER || undefined,
      password: env.SMTP_PASSWORD || undefined,
      from: env.EMAIL_FROM,
    });
  }
  return new ConsoleEmailProvider(logger);
}
