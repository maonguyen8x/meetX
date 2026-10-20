import { toElevenLabsSettings } from '../../realtime/pipeline/emotion-tagger.js';
import { CircuitBreaker } from '../resilience.js';
import { postStream, readBytes } from '../http.js';
import type { SynthesizeRequest, TtsChunk, TtsProvider } from './tts.provider.js';

export interface ElevenLabsConfig {
  apiKey: string;
  model: string;
  voiceMale: string;
  voiceFemale: string;
  baseUrl?: string;
}

export class ElevenLabsTtsProvider implements TtsProvider {
  private readonly breaker = new CircuitBreaker('elevenlabs');

  constructor(private readonly config: ElevenLabsConfig) {}

  async *synthesizeStream(request: SynthesizeRequest, signal?: AbortSignal): AsyncGenerator<TtsChunk> {
    const voiceId = request.voice.gender === 'MALE' ? this.config.voiceMale : this.config.voiceFemale;
    const response = await postStream(
      'elevenlabs',
      this.breaker,
      {
        url: `${this.config.baseUrl ?? 'https://api.elevenlabs.io'}/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=pcm_24000`,
        headers: { 'xi-api-key': this.config.apiKey },
        body: {
          text: request.text,
          model_id: this.config.model,
          voice_settings: toElevenLabsSettings(request.emotion, request.speed),
        },
      },
      {},
      signal,
    );

    let pending: Uint8Array | undefined;
    for await (const bytes of readBytes(response)) {
      // PCM16 samples are 2 bytes; keep chunks sample-aligned.
      const merged = pending ? concat(pending, bytes) : bytes;
      const usable = merged.byteLength - (merged.byteLength % 2);
      pending = usable < merged.byteLength ? merged.slice(usable) : undefined;
      if (usable > 0) yield { kind: 'audio', data: merged.slice(0, usable) };
    }
    yield { kind: 'usage', characters: request.text.length };
  }
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(a, 0);
  out.set(b, a.byteLength);
  return out;
}
