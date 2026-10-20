import { LANGUAGES } from '@meetx/shared';
import type { LanguageCode } from '@meetx/shared';
import WebSocket from 'ws';

import { AsyncQueue } from '../../utils/async-queue.js';
import { CircuitBreaker, callWithResilience } from '../resilience.js';
import type { SttEvent, SttProvider, SttStream, SttUsage } from './stt.provider.js';

export interface DeepgramConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

interface DeepgramResult {
  type?: string;
  is_final?: boolean;
  channel?: {
    alternatives?: { transcript?: string; confidence?: number; languages?: string[] }[];
  };
}

export class DeepgramSttProvider implements SttProvider {
  private readonly breaker = new CircuitBreaker('deepgram');

  constructor(private readonly config: DeepgramConfig) {}

  async open(options: { lang: LanguageCode | 'auto' }): Promise<SttStream> {
    const language = options.lang === 'auto' ? 'multi' : LANGUAGES[options.lang].sttCode;
    const query = new URLSearchParams({
      model: this.config.model,
      language,
      encoding: 'linear16',
      sample_rate: '16000',
      channels: '1',
      interim_results: 'true',
      endpointing: 'false',
      smart_format: 'true',
    });
    const url = `${this.config.baseUrl ?? 'wss://api.deepgram.com'}/v1/listen?${query.toString()}`;

    const socket = await callWithResilience(
      'deepgram',
      this.breaker,
      (signal) =>
        new Promise<WebSocket>((resolve, reject) => {
          const ws = new WebSocket(url, { headers: { authorization: `Token ${this.config.apiKey}` } });
          const abort = () => {
            ws.terminate();
            reject(new Error('Deepgram connection aborted'));
          };
          signal.addEventListener('abort', abort, { once: true });
          ws.once('open', () => {
            signal.removeEventListener('abort', abort);
            resolve(ws);
          });
          ws.once('error', reject);
        }),
      { timeoutMs: 5000 },
    );

    const queue = new AsyncQueue<SttEvent>();
    const fallbackLang: LanguageCode = options.lang === 'auto' ? 'en' : options.lang;
    let bytes = 0;

    socket.on('message', (raw: WebSocket.RawData) => {
      let message: DeepgramResult;
      try {
        message = JSON.parse(raw.toString()) as DeepgramResult;
      } catch {
        return;
      }
      if (message.type !== 'Results') return;
      const alternative = message.channel?.alternatives?.[0];
      const text = alternative?.transcript?.trim();
      if (!text) return;
      const detected = alternative?.languages?.[0]?.slice(0, 2);
      const lang = detected && detected in LANGUAGES ? (detected as LanguageCode) : fallbackLang;
      queue.push({
        kind: message.is_final ? 'final' : 'partial',
        text,
        lang,
        confidence: alternative?.confidence ?? 0,
      });
    });
    socket.on('close', () => queue.end());
    socket.on('error', () => queue.end());

    return {
      events: queue,
      push(frame) {
        if (socket.readyState !== WebSocket.OPEN) return;
        bytes += frame.byteLength;
        socket.send(frame);
      },
      finalize() {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'Finalize' }));
      },
      async close(): Promise<SttUsage> {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'CloseStream' }));
        socket.close();
        queue.end();
        return { audioSeconds: bytes / 2 / 16000 };
      },
    };
  }
}
