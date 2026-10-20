import type { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { MAX_CLIENT_FRAME_BYTES, clientMessageSchema } from '@meetx/shared/schemas/events';
import type { ClientMessage } from '@meetx/shared/schemas/events';
import type { SettingsResponse } from '@meetx/shared/schemas/settings';
import type { RawData, WebSocket } from 'ws';

import { can } from '../authorization/policy.js';
import type { Actor } from '../authorization/policy.js';
import { authenticateRequest } from '../plugins/auth.js';
import type { SttProvider } from '../providers/stt/stt.provider.js';
import type { GlossaryEntry, TranslateProvider } from '../providers/translate/translate.provider.js';
import type { TtsProvider } from '../providers/tts/tts.provider.js';
import { AppError } from '../utils/errors.js';
import { PipelineOrchestrator } from './pipeline/orchestrator.js';
import { RealtimeSession, SessionRegistry } from './session.js';
import type { SessionSink } from './session.js';
import type { UsageHooks } from './usage-hooks.js';

export interface RealtimeProviders {
  stt: SttProvider;
  translate: TranslateProvider;
  tts: TtsProvider;
}

export interface RealtimeDeps {
  /** Resolved lazily so the API can boot without vendor keys. */
  providers: () => RealtimeProviders;
  usage: UsageHooks;
  loadSettings: (userId: string) => Promise<SettingsResponse>;
  loadGlossary: (actor: Actor, source: string, target: string) => Promise<GlossaryEntry[]>;
  canUseMeeting: (userId: string, meetingId: string) => Promise<boolean>;
}

const HEARTBEAT_MS = 15_000;
const START_TIMEOUT_MS = 10_000;
const MAX_SESSIONS_PER_USER = 2;
const MAX_BYTES_PER_SECOND = 128_000; // 4x real-time PCM16 16 kHz

export function registerRealtimeGateway(app: FastifyInstance, deps: RealtimeDeps): SessionRegistry {
  const registry = new SessionRegistry();

  void app.register(async (instance) => {
    await instance.register(websocket, { options: { maxPayload: MAX_CLIENT_FRAME_BYTES } });

    instance.get(
      '/v1/ws/session',
      {
        websocket: true,
        // Browsers cannot set headers on WebSocket, so the access token travels in the query string.
        preValidation: async (request) => {
          const token = (request.query as { token?: unknown }).token;
          if (typeof token !== 'string' || token.length === 0) {
            throw new AppError('UNAUTHENTICATED', 'Authentication is required.', 401);
          }
          request.headers.authorization = `Bearer ${token}`;
          await authenticateRequest(request);
        },
      },
      (socket, request) => {
        const actor = request.actor;
        if (!actor) {
          socket.close(1008, 'Unauthenticated');
          return;
        }
        const resumeId = (request.query as { resume?: unknown }).resume;
        handleConnection(socket, actor, typeof resumeId === 'string' ? resumeId : undefined);
      },
    );
  });

  function handleConnection(socket: WebSocket, actor: Actor, resumeId: string | undefined): void {
    const log = app.log;
    let session: RealtimeSession | undefined;
    let starting = false;
    let alive = true;
    let windowStart = Date.now();
    let windowBytes = 0;

    const sink: SessionSink = {
      sendJson: (message) => {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
      },
      sendBinary: (data) => {
        if (socket.readyState === socket.OPEN) socket.send(data, { binary: true });
      },
      bufferedAmount: () => socket.bufferedAmount,
    };

    const sendError = (code: string, message: string): void => sink.sendJson({ type: 'error', code, message });

    const heartbeat = setInterval(() => {
      if (!alive) {
        socket.terminate();
        return;
      }
      alive = false;
      socket.ping();
    }, HEARTBEAT_MS);
    socket.on('pong', () => {
      alive = true;
    });

    const startTimer = setTimeout(() => {
      if (!session && !starting) socket.close(1008, 'session.start timeout');
    }, START_TIMEOUT_MS);

    const finish = async (target: RealtimeSession): Promise<void> => {
      registry.remove(target.id);
      await target.orchestrator?.end();
    };

    if (resumeId) {
      const existing = registry.resume(resumeId, actor.id);
      if (!existing) {
        sendError('SESSION_NOT_FOUND', 'The session cannot be resumed.');
        socket.close(1008, 'resume failed');
      } else {
        session = existing;
        session.attach(sink);
        sink.sendJson({ type: 'session.ready', sessionId: session.id, resumed: true });
      }
    }

    const start = async (message: Extract<ClientMessage, { type: 'session.start' }>): Promise<void> => {
      if (!can(actor, 'interpreter.use')) throw new AppError('FORBIDDEN', 'You cannot use the interpreter.', 403);
      if (registry.countForUser(actor.id) >= MAX_SESSIONS_PER_USER) {
        throw new AppError('TOO_MANY_SESSIONS', 'Too many active interpreter sessions.', 429);
      }
      if (message.meetingId && !(await deps.canUseMeeting(actor.id, message.meetingId))) {
        throw new AppError('NOT_FOUND', 'Meeting not found.', 404);
      }
      const [settings, glossary] = await Promise.all([
        deps.loadSettings(actor.id),
        deps.loadGlossary(actor, message.sourceLang, message.targetLang),
      ]);
      const providers = deps.providers();
      const created = new RealtimeSession(actor.id, (fields) => log.info(fields, 'pipeline latency'));
      created.orchestrator = new PipelineOrchestrator(
        {
          userId: actor.id,
          sessionId: created.id,
          sourceLang: message.sourceLang,
          targetLang: message.targetLang,
          mode: message.mode,
          persona: { name: settings.personaName },
          voice: { gender: settings.voiceGender, style: settings.voiceStyle },
          speed: settings.speed,
          endpointingMs: settings.endpointingMs,
          triggerMode: settings.triggerMode,
          glossary,
        },
        { ...providers, usage: deps.usage, emit: (event) => created.dispatch(event) },
      );
      await created.orchestrator.start();
      created.attach(sink);
      registry.add(created);
      session = created;
      sink.sendJson({ type: 'session.ready', sessionId: created.id, resumed: false });
    };

    const onJson = async (text: string): Promise<void> => {
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        sendError('INVALID_MESSAGE', 'Message must be valid JSON.');
        return;
      }
      const parsed = clientMessageSchema.safeParse(raw);
      if (!parsed.success) {
        sendError('INVALID_MESSAGE', 'Message does not match the protocol.');
        return;
      }
      const message = parsed.data;
      if (message.type === 'session.start') {
        if (session || starting) {
          sendError('ALREADY_STARTED', 'The session is already started.');
          return;
        }
        starting = true;
        try {
          await start(message);
        } catch (error) {
          starting = false;
          if (error instanceof AppError) sendError(error.code, error.message);
          else {
            log.error({ err: error }, 'failed to start realtime session');
            sendError('SESSION_START_FAILED', 'The interpreter could not be started.');
          }
          socket.close(1011, 'start failed');
        }
        return;
      }
      if (!session?.orchestrator) {
        sendError('NOT_STARTED', 'Send session.start first.');
        return;
      }
      switch (message.type) {
        case 'translate.now':
          session.orchestrator.translateNow();
          break;
        case 'mute.interpreter':
          session.orchestrator.setMuted(message.on);
          break;
        case 'recap.request':
          session.orchestrator.recap();
          break;
        case 'session.end':
          await finish(session);
          session = undefined;
          socket.close(1000, 'session ended');
          break;
      }
    };

    socket.on('message', (data: RawData, isBinary: boolean) => {
      if (isBinary) {
        const buffer = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer);
        const now = Date.now();
        if (now - windowStart >= 1000) {
          windowStart = now;
          windowBytes = 0;
        }
        windowBytes += buffer.byteLength;
        if (windowBytes > MAX_BYTES_PER_SECOND) {
          sendError('RATE_LIMITED', 'Audio is arriving faster than real time.');
          socket.close(1008, 'audio rate exceeded');
          return;
        }
        if (!session?.orchestrator) {
          sendError('NOT_STARTED', 'Send session.start first.');
          return;
        }
        if (buffer.byteLength === 0 || buffer.byteLength % 2 !== 0 || buffer.byteLength > MAX_CLIENT_FRAME_BYTES) {
          sendError('INVALID_FRAME', 'Audio frames must be PCM16 mono 16 kHz.');
          return;
        }
        session.orchestrator.pushAudio(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
        return;
      }
      const text = Array.isArray(data) ? Buffer.concat(data).toString('utf8') : Buffer.from(data as ArrayBuffer).toString('utf8');
      void onJson(text).catch((error: unknown) => {
        log.error({ err: error }, 'realtime message handler failed');
        sendError('INTERNAL', 'Unexpected error.');
      });
    });

    socket.on('close', () => {
      clearInterval(heartbeat);
      clearTimeout(startTimer);
      const current = session;
      if (!current) return;
      current.detach(() => {
        void finish(current);
      });
    });
    socket.on('error', (error: Error) => log.warn({ err: error }, 'realtime socket error'));
  }

  return registry;
}
