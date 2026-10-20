import { toOpenAiInstruction } from '../../realtime/pipeline/emotion-tagger.js';
import { CircuitBreaker } from '../resilience.js';
import { postStream, readBytes } from '../http.js';
import type { SynthesizeRequest, TtsChunk, TtsProvider } from './tts.provider.js';

export interface OpenAiTtsConfig {
  apiKey: string;
  model: string;
  voiceMale: string;
  voiceFemale: string;
  baseUrl?: string;
}

export class OpenAiTtsProvider implements TtsProvider {
  private readonly breaker = new CircuitBreaker('openai-tts');

  constructor(private readonly config: OpenAiTtsConfig) {}

  async *synthesizeStream(request: SynthesizeRequest, signal?: AbortSignal): AsyncGenerator<TtsChunk> {
    const voice = request.voice.gender === 'MALE' ? this.config.voiceMale : this.config.voiceFemale;
    const response = await postStream(
      'openai-tts',
      this.breaker,
      {
        url: `${this.config.baseUrl ?? 'https://api.openai.com'}/v1/audio/speech`,
        headers: { authorization: `Bearer ${this.config.apiKey}` },
        body: {
          model: this.config.model,
          voice,
          input: request.text,
          instructions: toOpenAiInstruction(request.emotion, request.voice.style),
          response_format: 'pcm', // raw PCM16 mono 24 kHz
          speed: Math.min(4, Math.max(0.25, request.speed)),
        },
      },
      {},
      signal,
    );

    let carry: Uint8Array | undefined;
    for await (const bytes of readBytes(response)) {
      let merged = bytes;
      if (carry) {
        merged = new Uint8Array(carry.byteLength + bytes.byteLength);
        merged.set(carry, 0);
        merged.set(bytes, carry.byteLength);
      }
      const usable = merged.byteLength - (merged.byteLength % 2);
      carry = usable < merged.byteLength ? merged.slice(usable) : undefined;
      if (usable > 0) yield { kind: 'audio', data: merged.slice(0, usable) };
    }
    yield { kind: 'usage', characters: request.text.length };
  }
}
