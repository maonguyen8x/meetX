import { buildSystemPrompt, buildUserMessage } from './prompts/interpreter.js';
import { CircuitBreaker } from '../resilience.js';
import { readSse, postStream } from '../http.js';
import type { LlmAdapterConfig } from './anthropic.provider.js';
import type { TranslateChunk, TranslateProvider, TranslateRequest } from './translate.provider.js';

interface OpenAiChunk {
  choices?: { delta?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

export class OpenAiTranslateProvider implements TranslateProvider {
  private readonly breaker = new CircuitBreaker('openai-translate');

  constructor(private readonly config: LlmAdapterConfig) {}

  async *translateStream(request: TranslateRequest, signal?: AbortSignal): AsyncGenerator<TranslateChunk> {
    const response = await postStream(
      'openai-translate',
      this.breaker,
      {
        url: `${this.config.baseUrl ?? 'https://api.openai.com'}/v1/chat/completions`,
        headers: { authorization: `Bearer ${this.config.apiKey}` },
        body: {
          model: this.config.model,
          stream: true,
          stream_options: { include_usage: true },
          messages: [
            { role: 'system', content: buildSystemPrompt(request) },
            { role: 'user', content: buildUserMessage(request) },
          ],
        },
      },
      {},
      signal,
    );

    let inputTokens = 0;
    let outputTokens = 0;
    for await (const data of readSse(response)) {
      if (data === '[DONE]') break;
      let chunk: OpenAiChunk;
      try {
        chunk = JSON.parse(data) as OpenAiChunk;
      } catch {
        continue;
      }
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) yield { kind: 'delta', text };
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? 0;
        outputTokens = chunk.usage.completion_tokens ?? 0;
      }
    }
    yield { kind: 'usage', inputTokens, outputTokens };
  }
}
