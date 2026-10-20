import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { DeepgramSttProvider } from './deepgram.provider.js';
import type { SttProvider } from './stt.provider.js';

export type { SttEvent, SttProvider, SttStream, SttUsage } from './stt.provider.js';

export function createSttProvider(): SttProvider {
  if (env.STT_PROVIDER !== 'deepgram') {
    throw new AppError('PROVIDER_NOT_CONFIGURED', `Unsupported STT_PROVIDER "${env.STT_PROVIDER}".`, 503);
  }
  if (!env.STT_API_KEY) throw new AppError('PROVIDER_NOT_CONFIGURED', 'STT_API_KEY is not set.', 503);
  return new DeepgramSttProvider({ apiKey: env.STT_API_KEY, model: env.STT_MODEL ?? 'nova-3' });
}
