import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { AnthropicTranslateProvider } from './anthropic.provider.js';
import { OpenAiTranslateProvider } from './openai.provider.js';
import type { TranslateProvider } from './translate.provider.js';

export type { TranslateChunk, TranslateProvider, TranslateRequest } from './translate.provider.js';

export function createTranslateProvider(): TranslateProvider {
  if (!env.TRANSLATE_API_KEY) {
    throw new AppError('PROVIDER_NOT_CONFIGURED', 'TRANSLATE_API_KEY is not set.', 503);
  }
  if (env.TRANSLATE_PROVIDER === 'anthropic') {
    return new AnthropicTranslateProvider({
      apiKey: env.TRANSLATE_API_KEY,
      model: env.TRANSLATE_MODEL ?? 'claude-sonnet-4-5',
    });
  }
  if (env.TRANSLATE_PROVIDER === 'openai') {
    return new OpenAiTranslateProvider({
      apiKey: env.TRANSLATE_API_KEY,
      model: env.TRANSLATE_MODEL ?? 'gpt-4.1',
    });
  }
  throw new AppError(
    'PROVIDER_NOT_CONFIGURED',
    `Unsupported TRANSLATE_PROVIDER "${env.TRANSLATE_PROVIDER}".`,
    503,
  );
}
