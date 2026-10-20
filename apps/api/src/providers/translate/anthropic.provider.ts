import { buildSystemPrompt, buildUserMessage } from './prompts/interpreter.js';
import { CircuitBreaker } from '../resilience.js';
import { readSse, postStream } from '../http.js';
import type { TranslateChunk, TranslateProvider, TranslateRequest } from './translate.provider.js';

export interface LlmAdapterConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

interface AnthropicEvent {
  type: string;
  message?: { usage?: { input_tokens?: number } };
  delta?: { text?: string };
  usage?: { output_tokens?: number };
}

export class AnthropicTranslateProvider implements TranslateProvider {
  private readonly breaker = new CircuitBreaker('anthropic');

  constructor(private readonly config: LlmAdapterConfig) {}

  async *translateStream(request: TranslateRequest, signal?: AbortSignal): AsyncGenerator<TranslateChunk> {
    const response = await postStream(
      'anthropic',
      this.breaker,
      {
        url: `${this.config.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`,
        headers: { 'x-api-key': this.config.apiKey, 'anthropic-version': '2023-06-01' },
        body: {
          model: this.config.model,
          max_tokens: 1024,
          stream: true,
          system: buildSystemPrompt(request),
          messages: [{ role: 'user', content: buildUserMessage(request) }],
        },
      },
      {},
      signal,
    );

    let inputTokens = 0;
    let outputTokens = 0;
    for await (const data of readSse(response)) {
      let event: AnthropicEvent;
      try {
        event = JSON.parse(data) as AnthropicEvent;
      } catch {
        continue;
      }
      if (event.type === 'message_start') inputTokens = event.message?.usage?.input_tokens ?? 0;
      else if (event.type === 'content_block_delta' && event.delta?.text) {
        yield { kind: 'delta', text: event.delta.text };
      } else if (event.type === 'message_delta') outputTokens = event.usage?.output_tokens ?? outputTokens;
    }
    yield { kind: 'usage', inputTokens, outputTokens };
  }
}
