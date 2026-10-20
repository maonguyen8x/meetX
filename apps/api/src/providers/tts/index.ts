import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { ElevenLabsTtsProvider } from './elevenlabs.provider.js';
import { OpenAiTtsProvider } from './openai.provider.js';
import type { TtsProvider } from './tts.provider.js';

export type { SynthesizeRequest, TtsChunk, TtsProvider } from './tts.provider.js';

export function createTtsProvider(): TtsProvider {
  if (!env.TTS_API_KEY) throw new AppError('PROVIDER_NOT_CONFIGURED', 'TTS_API_KEY is not set.', 503);
  if (env.TTS_PROVIDER === 'elevenlabs') {
    if (!env.TTS_VOICE_MALE || !env.TTS_VOICE_FEMALE) {
      throw new AppError('PROVIDER_NOT_CONFIGURED', 'TTS_VOICE_MALE and TTS_VOICE_FEMALE are required.', 503);
    }
    return new ElevenLabsTtsProvider({
      apiKey: env.TTS_API_KEY,
      model: env.TTS_MODEL ?? 'eleven_flash_v2_5',
      voiceMale: env.TTS_VOICE_MALE,
      voiceFemale: env.TTS_VOICE_FEMALE,
    });
  }
  if (env.TTS_PROVIDER === 'openai') {
    return new OpenAiTtsProvider({
      apiKey: env.TTS_API_KEY,
      model: env.TTS_MODEL ?? 'gpt-4o-mini-tts',
      voiceMale: env.TTS_VOICE_MALE ?? 'onyx',
      voiceFemale: env.TTS_VOICE_FEMALE ?? 'nova',
    });
  }
  throw new AppError('PROVIDER_NOT_CONFIGURED', `Unsupported TTS_PROVIDER "${env.TTS_PROVIDER}".`, 503);
}
