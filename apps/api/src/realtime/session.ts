import { randomUUID } from 'node:crypto';

import type { ServerMessage } from '@meetx/shared/schemas/events';

import type { PipelineEvent, PipelineOrchestrator } from './pipeline/orchestrator.js';

export const RESUME_GRACE_MS = 60_000;
export const MAX_BUFFERED_BYTES = 1_000_000;

/** Where a session writes; null while the client is disconnected and may still resume. */
export interface SessionSink {
  sendJson(message: ServerMessage): void;
  sendBinary(data: Uint8Array): void;
  bufferedAmount(): number;
}

export interface LatencyLog {
  (fields: { sessionId: string; turnId: string; sttMs: number; translateFirstMs: number; ttsFirstMs: number; totalMs: number }): void;
}

export class RealtimeSession {
  readonly id = randomUUID();
  orchestrator: PipelineOrchestrator | undefined;
  private sink: SessionSink | null = null;
  private graceTimer: NodeJS.Timeout | undefined;
  private readonly droppedAudioTurns = new Set<string>();

  constructor(
    readonly userId: string,
    private readonly logLatency: LatencyLog,
  ) {}

  get attached(): boolean {
    return this.sink !== null;
  }

  attach(sink: SessionSink): void {
    clearTimeout(this.graceTimer);
    this.sink = sink;
  }

  /** Keeps the pipeline alive for `RESUME_GRACE_MS` so the client can reconnect. */
  detach(onExpire: () => void): void {
    this.sink = null;
    clearTimeout(this.graceTimer);
    this.graceTimer = setTimeout(onExpire, RESUME_GRACE_MS);
    this.graceTimer.unref();
  }

  dispose(): void {
    clearTimeout(this.graceTimer);
    this.sink = null;
  }

  send(message: ServerMessage): void {
    this.sink?.sendJson(message);
  }

  /** Maps pipeline events to the wire protocol. Text always flows; audio is dropped under backpressure. */
  dispatch(event: PipelineEvent): void {
    const sink = this.sink;
    switch (event.type) {
      case 'turn.start':
      case 'caption.partial':
      case 'caption.final':
      case 'translation.text':
      case 'error':
        sink?.sendJson(event);
        return;
      case 'audio.start':
        if (sink && sink.bufferedAmount() > MAX_BUFFERED_BYTES) this.dropAudio(event.turnId);
        else sink?.sendJson({ type: 'translation.audio.start', turnId: event.turnId, format: 'pcm16', sampleRate: 24000 });
        return;
      case 'audio':
        if (!sink || this.droppedAudioTurns.has(event.turnId)) return;
        if (sink.bufferedAmount() > MAX_BUFFERED_BYTES) {
          this.dropAudio(event.turnId);
          return;
        }
        sink.sendBinary(event.data);
        return;
      case 'audio.end':
        if (!this.droppedAudioTurns.delete(event.turnId)) {
          sink?.sendJson({ type: 'translation.audio.end', turnId: event.turnId });
        }
        return;
      case 'usage':
        sink?.sendJson({ type: 'usage.tick', ...event.tick });
        return;
      case 'latency':
        this.logLatency({ sessionId: this.id, ...event });
        return;
    }
  }

  private dropAudio(turnId: string): void {
    if (this.droppedAudioTurns.has(turnId)) return;
    this.droppedAudioTurns.add(turnId);
    this.sink?.sendJson({ type: 'translation.audio.end', turnId });
    this.sink?.sendJson({
      type: 'error',
      code: 'BACKPRESSURE',
      message: 'Your connection is too slow; voice output was skipped for this turn.',
    });
  }
}

export class SessionRegistry {
  private readonly sessions = new Map<string, RealtimeSession>();

  add(session: RealtimeSession): void {
    this.sessions.set(session.id, session);
  }

  /** Only the owning user may resume, and only while no other connection is attached. */
  resume(id: string, userId: string): RealtimeSession | undefined {
    const session = this.sessions.get(id);
    if (!session || session.userId !== userId || session.attached) return undefined;
    return session;
  }

  countForUser(userId: string): number {
    let count = 0;
    for (const session of this.sessions.values()) if (session.userId === userId) count += 1;
    return count;
  }

  remove(id: string): void {
    this.sessions.get(id)?.dispose();
    this.sessions.delete(id);
  }
}
