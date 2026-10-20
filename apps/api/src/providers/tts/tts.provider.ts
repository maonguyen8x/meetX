import type { LanguageCode } from '@meetx/shared';
import type { Emotion } from '@meetx/shared/schemas/events';

export interface SynthesizeRequest {
  text: string;
  lang: LanguageCode;
  voice: { gender: 'MALE' | 'FEMALE' | 'NEUTRAL'; style: 'WARM' | 'PROFESSIONAL' | 'ENERGETIC' };
  emotion: Emotion;
  speed: number;
}

export type TtsChunk =
  | { kind: 'audio'; data: Uint8Array } // PCM16 mono 24 kHz
  | { kind: 'usage'; characters: number };

export interface TtsProvider {
  synthesizeStream(request: SynthesizeRequest, signal?: AbortSignal): AsyncIterable<TtsChunk>;
}
