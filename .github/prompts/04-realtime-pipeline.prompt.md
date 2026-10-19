---
mode: agent
description: Phase 04 - Provider abstractions and realtime translation pipeline
---
# Phase 04 — Realtime Pipeline (most important phase)
Read: docs/02-architecture.md, docs/07-translation-voice-spec.md, docs/10-api-contracts.md (WebSocket part).

## Task
1. Provider interfaces + adapters in `apps/api/src/providers`:
   - `SttProvider`: `stream(lang|auto) → AsyncIterable<{partial|final, text, lang, confidence}>`; adapter: Deepgram streaming.
   - `TranslateProvider`: `translateStream({text, source, target, persona, glossary, summary, lastTurns, mode}) → AsyncIterable<sentence+emotion>`; adapters: anthropic.ts and openai.ts selected by env. Put the system prompt from docs/07 in `prompts/interpreter.ts`.
   - `TtsProvider`: `synthesizeStream({text, lang, voice, emotion, speed}) → AsyncIterable<Uint8Array PCM16 24k>`; adapters: elevenlabs.ts, openai.ts.
   - Each adapter has timeout, max 2 retries, circuit breaker, and returns usage numbers for metering.
2. `realtime/pipeline`: `vad.ts`, `endpointing.ts` (silence + trigger phrases + manual override), `segmenter.ts` (sentence chunking), `context-builder.ts`, `emotion-tagger.ts`, `orchestrator.ts` (STT → translate → TTS streaming, sentence-level overlap).
3. `realtime/gateway.ts` + `session.ts`: WebSocket protocol exactly as in docs/10; heartbeat; reconnect with session resume; backpressure.
4. Emit `usage.tick` and call `usage` module hooks (stub allowed until phase 11).
5. Fake providers for tests under `apps/api/test/fakes`.

## Tests
Unit: endpointing, segmenter, emotion-tagger, context-builder. Integration: WebSocket session with fake providers verifies event order and latency logging.

## Definition of Done
A CLI script `pnpm --filter api demo:cli` streams a sample WAV (vi) and plays back/saves translated audio (ja) using fake or live providers.
