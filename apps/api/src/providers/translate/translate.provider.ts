import type { LanguageCode } from '@meetx/shared';
import type { InterpretMode } from '@meetx/shared/schemas/events';

export interface GlossaryEntry {
  source: string;
  target: string;
}

export interface TranslateRequest {
  text: string;
  source: LanguageCode;
  target: LanguageCode;
  persona: { name: string };
  glossary: GlossaryEntry[];
  summary: string;
  lastTurns: { speaker: string; text: string }[];
  mode: InterpretMode;
}

export type TranslateChunk =
  | { kind: 'delta'; text: string }
  | { kind: 'usage'; inputTokens: number; outputTokens: number };

export interface TranslateProvider {
  /** Streams text deltas (may contain inline [emotion] tags); the pipeline segments them into sentences. */
  translateStream(request: TranslateRequest, signal?: AbortSignal): AsyncIterable<TranslateChunk>;
}
