import { randomUUID } from 'node:crypto';

import type { LanguageCode } from '@meetx/shared';
import { LANGUAGES } from '@meetx/shared';
import type { Emotion, InterpretMode } from '@meetx/shared/schemas/events';

import type { SttStream } from '../../providers/stt/stt.provider.js';
import type { SttProvider } from '../../providers/stt/stt.provider.js';
import type { GlossaryEntry, TranslateProvider } from '../../providers/translate/translate.provider.js';
import type { TtsProvider } from '../../providers/tts/tts.provider.js';
import { AsyncQueue } from '../../utils/async-queue.js';
import type { UsageHooks, UsageTick } from '../usage-hooks.js';
import { ContextBuilder } from './context-builder.js';
import { Endpointer, stripTriggerPhrase } from './endpointing.js';
import type { EndpointSignal } from './endpointing.js';
import { ensureSentenceEnd, parseEmotionTag } from './emotion-tagger.js';
import { SentenceSegmenter } from './segmenter.js';
import { EnergyVad } from './vad.js';

export type PipelineEvent =
  | { type: 'turn.start'; turnId: string; speaker: string; lang: LanguageCode }
  | { type: 'caption.partial' | 'caption.final'; turnId: string; text: string; lang: LanguageCode }
  | { type: 'translation.text'; turnId: string; text: string; lang: LanguageCode; emotion: Emotion }
  | { type: 'audio.start'; turnId: string }
  | { type: 'audio'; turnId: string; data: Uint8Array }
  | { type: 'audio.end'; turnId: string }
  | { type: 'usage'; tick: UsageTick }
  | { type: 'latency'; turnId: string; sttMs: number; translateFirstMs: number; ttsFirstMs: number; totalMs: number }
  | { type: 'error'; code: string; message: string };

export interface PipelineConfig {
  userId: string;
  sessionId: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  mode: InterpretMode;
  persona: { name: string };
  voice: { gender: 'MALE' | 'FEMALE' | 'NEUTRAL'; style: 'WARM' | 'PROFESSIONAL' | 'ENERGETIC' };
  speed: number;
  endpointingMs: number;
  triggerMode: 'AUTO' | 'MANUAL' | 'SUMMARY';
  glossary: GlossaryEntry[];
  /** Open STT with language auto-detect and translate in whichever direction the speaker used. */
  autoDetect?: boolean;
  speaker?: string;
  sttFinalTimeoutMs?: number;
}

export interface PipelineDeps {
  stt: SttProvider;
  translate: TranslateProvider;
  tts: TtsProvider;
  usage: UsageHooks;
  emit: (event: PipelineEvent) => void;
  now?: () => number;
  summarize?: (previous: string, turns: readonly { speaker: string; text: string }[]) => Promise<string>;
}

interface ActiveTurn {
  id: string;
  finals: string[];
  partial: string;
  lang: LanguageCode;
  confidence: number;
  finalizing: boolean;
  finalWaiters: (() => void)[];
}

const CONFIDENCE_FLOOR = 0.6;
const SUMMARY_MIN_CHARS = 120;

export class PipelineOrchestrator {
  readonly context: ContextBuilder;
  private stt: SttStream | undefined;
  private readonly vad = new EnergyVad();
  private readonly endpointer: Endpointer;
  private readonly abort = new AbortController();
  private readonly now: () => number;
  private turn: ActiveTurn | undefined;
  private restartAfterFinalize = false;
  private work: Promise<void> = Promise.resolve();
  private muted = false;
  private ended = false;
  private pendingAudioSeconds = 0;

  constructor(
    private config: PipelineConfig,
    private readonly deps: PipelineDeps,
  ) {
    this.now = deps.now ?? (() => performance.now());
    this.context = new ContextBuilder(this.now);
    this.endpointer = new Endpointer({
      endpointingMs: config.endpointingMs,
      triggerPhrases: [...LANGUAGES[config.sourceLang].triggerPhrases],
      silenceEnabled: config.triggerMode !== 'MANUAL',
    });
  }

  async start(): Promise<void> {
    this.stt = await this.deps.stt.open({ lang: this.config.autoDetect ? 'auto' : this.config.sourceLang });
    void this.consumeStt(this.stt);
  }

  pushAudio(frame: Uint8Array): void {
    if (this.ended || !this.stt) return;
    this.stt.push(frame);
    this.pendingAudioSeconds += frame.byteLength / 2 / 16000;
    this.handleSignal(this.endpointer.onFrame(this.vad.isSpeech(frame)));
  }

  translateNow(): void {
    this.handleSignal(this.endpointer.manual());
  }

  setMuted(on: boolean): void {
    this.muted = on;
  }

  recap(): void {
    this.enqueue(async () => {
      const turnId = randomUUID();
      this.deps.emit({
        type: 'turn.start',
        turnId,
        speaker: this.config.persona.name,
        lang: this.config.targetLang,
      });
      await this.interpret({
        turnId,
        text: 'Recap requested.',
        source: this.config.sourceLang,
        target: this.config.targetLang,
        mode: 'recap',
        endpointAt: this.now(),
        sttDoneAt: this.now(),
        record: false,
      });
    });
  }

  /** Finishes the in-flight turn, waits for queued output, then releases the STT stream. */
  async end(): Promise<void> {
    if (this.ended) return;
    if (this.turn) await this.finalizeTurn('manual');
    await this.work;
    this.ended = true;
    this.abort.abort();
    await this.stt?.close();
  }

  private enqueue(job: () => Promise<void>): void {
    this.work = this.work.then(job).catch(() => {
      if (this.abort.signal.aborted) return;
      this.deps.emit({ type: 'error', code: 'PIPELINE_FAILED', message: 'Interpretation failed for this turn.' });
    });
  }

  private handleSignal(signal: EndpointSignal): void {
    if (!signal) return;
    if (signal.type === 'speech.start') this.beginTurn();
    else void this.finalizeTurn(signal.reason);
  }

  private beginTurn(): void {
    if (this.turn) {
      if (this.turn.finalizing) this.restartAfterFinalize = true;
      return;
    }
    this.turn = {
      id: randomUUID(),
      finals: [],
      partial: '',
      lang: this.config.sourceLang,
      confidence: 1,
      finalizing: false,
      finalWaiters: [],
    };
    this.deps.emit({
      type: 'turn.start',
      turnId: this.turn.id,
      speaker: this.config.speaker ?? 'speaker',
      lang: this.config.sourceLang,
    });
  }

  private async consumeStt(stream: SttStream): Promise<void> {
    try {
      for await (const event of stream.events) {
        const turn = this.turn;
        if (!turn) continue;
        turn.lang = event.lang;
        turn.confidence = event.confidence;
        if (event.kind === 'partial') {
          turn.partial = event.text;
          this.deps.emit({ type: 'caption.partial', turnId: turn.id, text: event.text, lang: event.lang });
        } else {
          turn.finals.push(event.text);
          turn.partial = '';
          for (const wake of turn.finalWaiters.splice(0)) wake();
        }
        if (!turn.finalizing) {
          this.handleSignal(this.endpointer.onTranscript([...turn.finals, turn.partial].join(' ')));
        }
      }
    } catch {
      if (!this.abort.signal.aborted) {
        this.deps.emit({ type: 'error', code: 'STT_FAILED', message: 'Speech recognition was interrupted.' });
      }
    }
  }

  private waitForFinal(turn: ActiveTurn): Promise<void> {
    if (turn.partial === '' && turn.finals.length > 0) return Promise.resolve();
    const timeoutMs = this.config.sttFinalTimeoutMs ?? 800;
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      turn.finalWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private async finalizeTurn(reason: 'silence' | 'trigger' | 'manual'): Promise<void> {
    const turn = this.turn;
    if (!turn || turn.finalizing || !this.stt) return;
    turn.finalizing = true;
    const endpointAt = this.now();
    this.stt.finalize();
    await this.waitForFinal(turn);
    const sttDoneAt = this.now();

    let text = [...turn.finals, turn.partial].join(' ').replace(/\s+/g, ' ').trim();
    if (reason === 'trigger') text = stripTriggerPhrase(text, LANGUAGES[this.config.sourceLang].triggerPhrases);
    this.turn = undefined;
    if (this.restartAfterFinalize) {
      this.restartAfterFinalize = false;
      this.beginTurn();
    }
    if (!text) return;

    this.enqueue(() => this.processTurn(turn, text, endpointAt, sttDoneAt));
  }

  private async processTurn(turn: ActiveTurn, text: string, endpointAt: number, sttDoneAt: number): Promise<void> {
    let source = this.config.sourceLang;
    let target = this.config.targetLang;
    if (this.config.autoDetect && turn.confidence >= CONFIDENCE_FLOOR && turn.lang === target) {
      [source, target] = [target, source];
    }
    this.deps.emit({ type: 'caption.final', turnId: turn.id, text, lang: source });

    let mode: InterpretMode = this.config.mode;
    if (isAddressedTo(text, this.config.persona.name)) mode = 'reply_as_assistant';
    else if (this.config.triggerMode === 'SUMMARY' && text.length >= SUMMARY_MIN_CHARS) mode = 'summarize_turn';

    await this.interpret({ turnId: turn.id, text, source, target, mode, endpointAt, sttDoneAt, record: true });
  }

  private async interpret(job: {
    turnId: string;
    text: string;
    source: LanguageCode;
    target: LanguageCode;
    mode: InterpretMode;
    endpointAt: number;
    sttDoneAt: number;
    record: boolean;
  }): Promise<void> {
    const { turnId } = job;
    const outLang = job.mode === 'reply_as_assistant' ? job.source : job.target;
    const context = this.context.build();
    const segmenter = new SentenceSegmenter();
    const synthesis: Promise<void>[] = [];
    let playback: Promise<void> = Promise.resolve();
    let audioStarted = false;
    let firstSentenceAt: number | undefined;
    let firstAudioAt: number | undefined;
    let inputTokens = 0;
    let outputTokens = 0;
    let ttsCharacters = 0;
    const spoken: string[] = [];

    const onSentence = (raw: string): void => {
      const { text, emotion } = parseEmotionTag(raw);
      if (!text) return;
      spoken.push(text);
      firstSentenceAt ??= this.now();
      this.deps.emit({ type: 'translation.text', turnId, text, lang: outLang, emotion });
      if (this.muted) return;

      const queue = new AsyncQueue<Uint8Array>();
      synthesis.push(
        (async () => {
          try {
            for await (const chunk of this.deps.tts.synthesizeStream(
              {
                text: ensureSentenceEnd(text),
                lang: outLang,
                voice: this.config.voice,
                emotion,
                speed: this.config.speed,
              },
              this.abort.signal,
            )) {
              if (chunk.kind === 'audio') queue.push(chunk.data);
              else ttsCharacters += chunk.characters;
            }
          } catch {
            if (!this.abort.signal.aborted) {
              this.deps.emit({ type: 'error', code: 'TTS_FAILED', message: 'Voice output failed; text is still shown.' });
            }
          } finally {
            queue.end();
          }
        })(),
      );
      playback = playback.then(async () => {
        for await (const data of queue) {
          if (!audioStarted) {
            audioStarted = true;
            firstAudioAt = this.now();
            this.deps.emit({ type: 'audio.start', turnId });
          }
          this.deps.emit({ type: 'audio', turnId, data });
        }
      });
    };

    try {
      const stream = this.deps.translate.translateStream(
        {
          text: job.text,
          source: job.source,
          target: job.target,
          persona: this.config.persona,
          glossary: this.config.glossary,
          summary: context.summary,
          lastTurns: context.lastTurns,
          mode: job.mode,
        },
        this.abort.signal,
      );
      for await (const chunk of stream) {
        if (chunk.kind === 'usage') {
          inputTokens += chunk.inputTokens;
          outputTokens += chunk.outputTokens;
        } else {
          for (const sentence of segmenter.push(chunk.text)) onSentence(sentence);
        }
      }
      const rest = segmenter.flush();
      if (rest) onSentence(rest);
    } catch {
      if (!this.abort.signal.aborted) {
        this.deps.emit({ type: 'error', code: 'TRANSLATE_FAILED', message: 'Translation failed for this turn.' });
      }
    }

    await playback;
    await Promise.all(synthesis);
    if (audioStarted) this.deps.emit({ type: 'audio.end', turnId });

    const doneAt = this.now();
    this.deps.emit({
      type: 'latency',
      turnId,
      sttMs: Math.round(job.sttDoneAt - job.endpointAt),
      translateFirstMs: firstSentenceAt === undefined ? -1 : Math.round(firstSentenceAt - job.sttDoneAt),
      ttsFirstMs:
        firstAudioAt === undefined || firstSentenceAt === undefined ? -1 : Math.round(firstAudioAt - firstSentenceAt),
      totalMs: Math.round(doneAt - job.endpointAt),
    });

    if (job.record) {
      this.context.addTurn({ speaker: this.config.speaker ?? 'speaker', text: job.text });
      await this.refreshSummary();
      await this.reportUsage(turnId, inputTokens, outputTokens, ttsCharacters);
    }
  }

  private async refreshSummary(): Promise<void> {
    if (!this.deps.summarize || !this.context.shouldRefreshSummary()) return;
    try {
      const next = await this.deps.summarize(this.context.build().summary, this.context.allTurns().slice(-10));
      this.context.setSummary(next);
    } catch {
      // Keep the previous summary; it is only a quality aid.
    }
  }

  private async reportUsage(turnId: string, input: number, output: number, ttsChars: number): Promise<void> {
    const sttSeconds = this.pendingAudioSeconds;
    this.pendingAudioSeconds = 0;
    try {
      const tick = await this.deps.usage.record({
        userId: this.config.userId,
        sessionId: this.config.sessionId,
        turnId,
        sttSeconds,
        llmInputTokens: input,
        llmOutputTokens: output,
        ttsCharacters: ttsChars,
      });
      this.deps.emit({ type: 'usage', tick });
    } catch {
      this.deps.emit({ type: 'error', code: 'USAGE_FAILED', message: 'Usage could not be recorded.' });
    }
  }
}

export function isAddressedTo(text: string, personaName: string): boolean {
  const name = personaName.trim().toLowerCase();
  if (!name) return false;
  const normalized = text.trim().toLowerCase();
  return normalized.startsWith(name) && /^[\s,，、:!?]/u.test(normalized.slice(name.length));
}
