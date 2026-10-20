import type {
  TranslateChunk,
  TranslateProvider,
  TranslateRequest,
} from '../../src/providers/translate/translate.provider.js';

export interface FakeTranslateOptions {
  /** Exact source text to translated text (may contain inline [emotion] tags). */
  translations?: Record<string, string>;
  delayMs?: number;
  failWith?: Error;
}

export class FakeTranslateProvider implements TranslateProvider {
  readonly requests: TranslateRequest[] = [];

  constructor(private readonly options: FakeTranslateOptions = {}) {}

  async *translateStream(request: TranslateRequest, signal?: AbortSignal): AsyncGenerator<TranslateChunk> {
    this.requests.push(request);
    if (this.options.failWith) throw this.options.failWith;
    const output = this.options.translations?.[request.text] ?? `[${request.target}] ${request.text}`;
    for (let i = 0; i < output.length; i += 8) {
      if (signal?.aborted) return;
      if (this.options.delayMs) await new Promise((r) => setTimeout(r, this.options.delayMs));
      yield { kind: 'delta', text: output.slice(i, i + 8) };
    }
    yield { kind: 'usage', inputTokens: Math.ceil(request.text.length / 4) + 50, outputTokens: Math.ceil(output.length / 4) };
  }
}
