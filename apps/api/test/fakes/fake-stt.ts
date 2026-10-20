import type { LanguageCode } from '@meetx/shared';

import { frameRms } from '../../src/realtime/pipeline/vad.js';
import type { SttEvent, SttProvider, SttStream, SttUsage } from '../../src/providers/stt/stt.provider.js';
import { AsyncQueue } from '../../src/utils/async-queue.js';

export interface FakeSttOptions {
  /** One entry per utterance, consumed in order on each finalize(). */
  script: string[];
  lang?: LanguageCode;
  confidence?: number;
  /** Emit a growing partial every N voiced frames. */
  partialEvery?: number;
  failOnOpen?: boolean;
}

export class FakeSttProvider implements SttProvider {
  constructor(private readonly options: FakeSttOptions) {}

  async open(): Promise<SttStream> {
    if (this.options.failOnOpen) throw new Error('fake stt unavailable');
    const queue = new AsyncQueue<SttEvent>();
    const lang = this.options.lang ?? 'vi';
    const confidence = this.options.confidence ?? 0.95;
    const partialEvery = this.options.partialEvery ?? 10;
    const script = [...this.options.script];
    let voiced = 0;
    let totalBytes = 0;

    return {
      events: queue,
      push: (frame) => {
        totalBytes += frame.byteLength;
        if (frameRms(frame) < 0.01) return;
        voiced += 1;
        const next = script[0];
        if (next && voiced % partialEvery === 0) {
          const length = Math.max(1, Math.ceil(next.length * Math.min(1, voiced / 50)));
          queue.push({ kind: 'partial', text: next.slice(0, length), lang, confidence });
        }
      },
      finalize: () => {
        if (voiced === 0) return;
        const text = script.shift();
        voiced = 0;
        if (text) queue.push({ kind: 'final', text, lang, confidence });
      },
      close: async (): Promise<SttUsage> => {
        queue.end();
        return { audioSeconds: totalBytes / 2 / 16000 };
      },
    };
  }
}
