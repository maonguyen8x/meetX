# 02 — Architecture

## Core pipeline (shared by both products)
```
Audio in (PCM16 16 kHz mono, 20 ms frames)
 → VAD + Endpointing (turn detection)
 → Streaming STT (+ language ID, speaker label)
 → Context Builder (glossary, rolling summary, last N turns, persona, tone)
 → Translator (LLM, streaming, sentence-chunked)
 → Emotion/Prosody tagger (inline style hints)
 → Streaming TTS (voice per persona)
 → Audio out (Opus/PCM) + Caption events
```
Everything is streamed sentence-by-sentence: the TTS of sentence 1 starts before the LLM finishes sentence 3.

## Components
| Component | Location | Responsibility |
|---|---|---|
| Realtime Gateway | `apps/api/src/realtime` | WebSocket sessions, audio frames in/out, backpressure |
| Pipeline Orchestrator | `apps/api/src/realtime/pipeline` | Runs the chain above per session, emits events |
| Providers | `apps/api/src/providers` | `SttProvider`, `TranslateProvider`, `TtsProvider` interfaces + adapters |
| Meeting Bot Service | `apps/api/src/integrations/meeting-bot` | Create bot via meeting-bot vendor API, receive per-participant audio, inject output audio |
| Room Service | `apps/api/src/integrations/livekit` | Tokens, rooms, interpreter agent that joins rooms |
| Memory Service | `apps/api/src/modules/memory` | Rolling summary, glossary, recap |
| Usage/Billing | `apps/api/src/modules/usage`, `billing` | Metering every provider call, wallet, limits |
| Web App | `apps/web` | UI, mic capture (AudioWorklet), playback, LiveKit client |

## Meeting Bot Mode flow
1. `POST /v1/bots` with meeting URL → Meeting Bot Service creates a bot (vendor API, default adapter: Recall.ai; interface `MeetingBotProvider` allows swapping).
2. Vendor streams per-participant audio via WebSocket to `/v1/ws/bot/:botId` → pipeline.
3. Translated audio is posted back to the vendor's "output audio" endpoint so the bot speaks in the meeting.
4. Original participants' voices remain audible in the meeting. The bot's voice is added on top.

## Standalone Mode flow
1. Client joins LiveKit room with token from `POST /v1/rooms/:id/token`.
2. Interpreter agent (server worker in `apps/api`) subscribes to each speaker track, runs the pipeline, and publishes one translated audio track per target language: `interp-<lang>`.
3. Each client subscribes to the `interp-<listenLanguage>` track and ducks original audio.

## Events (WebSocket, JSON) — see 10-api-contracts.md
`caption.partial`, `caption.final`, `translation.text`, `translation.audio` (binary), `turn.start`, `turn.end`, `usage.tick`, `error`.

## Data stores
- PostgreSQL: users, settings, meetings, turns, summaries, glossary, usage_events, wallets.
- Redis: session state, rate limits, pub/sub for scaling gateway horizontally.
- Object storage (S3-compatible): optional cloud copies of transcripts/avatars.

## Scaling rules
Stateless API nodes; session affinity by `sessionId` through Redis; one pipeline instance per active speaker stream; provider adapters have timeouts, retry (max 2) and circuit breaker.
