import type { Logger } from 'pino';

import type { EmailMessage, EmailProvider } from './email.provider.js';

export class ConsoleEmailProvider implements EmailProvider {
  constructor(private readonly logger: Logger) {}

  send(message: EmailMessage): Promise<void> {
    this.logger.info({ to: message.to, subject: message.subject }, `[email]\n${message.text}`);
    return Promise.resolve();
  }
}
