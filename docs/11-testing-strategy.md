# 11 — Testing Strategy & Demo Script

## Automated
- Unit (Vitest): endpointing, segmenter, context-builder, emotion-tagger, credit formula, wallet debits, Zod schemas.
- Integration: pipeline with fake STT/Translate/TTS providers (fixtures in `apps/api/test/fixtures`); WebSocket protocol tests; Prisma against a test DB (docker).
- E2E (Playwright): login → settings → start Standalone room with fake audio device → caption appears → usage updates.
- Latency benchmark script `pnpm bench:pipeline` prints p50/p95 per stage with fake providers + optional live providers (`LIVE=1`).

## Manual demo script (must work at the end)
1. `pnpm infra:up && pnpm db:migrate && pnpm dev`.
2. Sign in, open Settings, set name "Mika", upload avatar, choose female voice, press Preview in vi/ja/en.
3. **Standalone demo**: open two browsers; A speaks Vietnamese / listens Japanese, B speaks Japanese / listens Vietnamese. Speak a sentence; verify captions + translated voice + usage ticker.
4. **Bot demo**: paste a Google Meet link, start bot, admit it from the host, speak Vietnamese, hear Japanese output in meeting.
5. End meeting → History shows summary; download `.md`.
6. Usage page shows cost by day.

## Definition of Done (every phase)
`pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass; new env vars added to `.env.example`; docs updated if contracts changed.
