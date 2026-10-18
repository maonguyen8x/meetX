# Interpreter AI
Real-time voice-to-voice AI interpreter (vi / ja / en and more).

## Quick start
1. Copy `.env.example` to `.env` and fill provider keys.
2. `pnpm install && pnpm infra:up && pnpm db:migrate && pnpm dev`
3. Open http://localhost:3000

Build order: run prompts in `.github/prompts/` from `00` to `08`. See `AGENTS.md`.
