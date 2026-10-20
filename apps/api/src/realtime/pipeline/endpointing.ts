export type EndpointReason = 'silence' | 'trigger' | 'manual';

export interface EndpointingOptions {
  endpointingMs: number;
  triggerPhrases: readonly string[];
  /** When false (manual trigger mode) silence never ends a turn. */
  silenceEnabled?: boolean;
  frameMs?: number;
  /** Consecutive voiced frames needed to open a turn (filters clicks). */
  speechStartFrames?: number;
}

export type EndpointSignal = { type: 'speech.start' } | { type: 'endpoint'; reason: EndpointReason } | null;

const TRAILING_PUNCTUATION = /[\s.,!?;:。、！？…]+$/u;

export function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFKC').replace(TRAILING_PUNCTUATION, '').trim();
}

/** Returns the trigger phrase `text` ends with, if any. */
export function findTrailingTrigger(text: string, phrases: readonly string[]): string | undefined {
  const normalized = normalizeText(text);
  return phrases.find((phrase) => normalized.endsWith(normalizeText(phrase)));
}

export function stripTriggerPhrase(text: string, phrases: readonly string[]): string {
  const phrase = findTrailingTrigger(text, phrases);
  if (!phrase) return text.trim();
  const trimmed = text.replace(TRAILING_PUNCTUATION, '');
  return trimmed.slice(0, Math.max(0, trimmed.length - phrase.length)).replace(/[\s,、]+$/u, '').trim();
}

/** Silence + trigger phrase + manual override. Time is measured in audio frames, not wall clock. */
export class Endpointer {
  private speaking = false;
  private voicedRun = 0;
  private silenceMs = 0;
  private readonly frameMs: number;
  private readonly speechStartFrames: number;

  constructor(private options: EndpointingOptions) {
    this.frameMs = options.frameMs ?? 20;
    this.speechStartFrames = options.speechStartFrames ?? 3;
  }

  get isSpeaking(): boolean {
    return this.speaking;
  }

  configure(patch: Partial<EndpointingOptions>): void {
    this.options = { ...this.options, ...patch };
  }

  onFrame(voiced: boolean): EndpointSignal {
    if (!this.speaking) {
      this.voicedRun = voiced ? this.voicedRun + 1 : 0;
      if (this.voicedRun >= this.speechStartFrames) {
        this.speaking = true;
        this.silenceMs = 0;
        return { type: 'speech.start' };
      }
      return null;
    }
    if (voiced) {
      this.silenceMs = 0;
      return null;
    }
    this.silenceMs += this.frameMs;
    if ((this.options.silenceEnabled ?? true) && this.silenceMs >= this.options.endpointingMs) {
      this.reset();
      return { type: 'endpoint', reason: 'silence' };
    }
    return null;
  }

  onTranscript(text: string): EndpointSignal {
    if (!this.speaking || !findTrailingTrigger(text, this.options.triggerPhrases)) return null;
    this.reset();
    return { type: 'endpoint', reason: 'trigger' };
  }

  manual(): EndpointSignal {
    if (!this.speaking) return null;
    this.reset();
    return { type: 'endpoint', reason: 'manual' };
  }

  reset(): void {
    this.speaking = false;
    this.voicedRun = 0;
    this.silenceMs = 0;
  }
}
