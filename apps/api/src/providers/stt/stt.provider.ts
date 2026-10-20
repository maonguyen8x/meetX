import type { LanguageCode } from '@meetx/shared';

export interface SttEvent {
  kind: 'partial' | 'final';
  text: string;
  lang: LanguageCode;
  confidence: number;
}

export interface SttUsage {
  audioSeconds: number;
}

export interface SttStream {
  /** PCM16 mono 16 kHz audio. */
  push(frame: Uint8Array): void;
  /** Ask the engine to flush the current utterance as a final result (endpoint reached). */
  finalize(): void;
  close(): Promise<SttUsage>;
  readonly events: AsyncIterable<SttEvent>;
}

export interface SttProvider {
  open(options: { lang: LanguageCode | 'auto' }): Promise<SttStream>;
}
