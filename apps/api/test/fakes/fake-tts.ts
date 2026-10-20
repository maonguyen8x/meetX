import type { SynthesizeRequest, TtsChunk, TtsProvider } from '../../src/providers/tts/tts.provider.js';
import { outputChunk } from './audio.js';

export interface FakeTtsOptions {
  /** Milliseconds of audio produced per character of text. */
  msPerChar?: number;
  delayMs?: number;
  failWith?: Error;
}

export class FakeTtsProvider implements TtsProvider {
  readonly requests: SynthesizeRequest[] = [];

  constructor(private readonly options: FakeTtsOptions = {}) {}

  async *synthesizeStream(request: SynthesizeRequest, signal?: AbortSignal): AsyncGenerator<TtsChunk> {
    this.requests.push(request);
    if (this.options.failWith) throw this.options.failWith;
    const chunks = Math.max(1, Math.ceil((request.text.length * (this.options.msPerChar ?? 60)) / 20));
    for (let i = 0; i < chunks; i += 1) {
      if (signal?.aborted) return;
      if (this.options.delayMs) await new Promise((r) => setTimeout(r, this.options.delayMs));
      yield { kind: 'audio', data: outputChunk(request.lang === 'ja' ? 523 : request.lang === 'vi' ? 392 : 440) };
    }
    yield { kind: 'usage', characters: request.text.length };
  }
}
