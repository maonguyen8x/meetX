# 03 — Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | |
| Web | Next.js (App Router), React, TypeScript, Tailwind, shadcn/ui, Framer Motion | Font: Inter (Latin/Vietnamese) + Noto Sans JP |
| State/data | Zustand, TanStack Query, Zod | |
| Realtime media (standalone) | LiveKit (self-host via docker, or LiveKit Cloud) | WebRTC SFU |
| Audio in browser | AudioWorklet (PCM16 16k), WebAudio for ducking | |
| API | Fastify, `@fastify/websocket`, Zod type provider | |
| DB | PostgreSQL + Prisma; Redis | |
| Auth | Auth.js (NextAuth) with Google + email magic link; JWT for API | |
| STT | Interface `SttProvider`; default adapter Deepgram streaming (supports vi/ja/en); alt: OpenAI transcription | |
| Translation LLM | Interface `TranslateProvider`; default adapter Anthropic Claude or OpenAI GPT (selected by env `TRANSLATE_PROVIDER`) | Streaming, low temperature |
| TTS | Interface `TtsProvider`; default adapter ElevenLabs multilingual streaming; alt: OpenAI TTS with instruction prompts | Emotional voices |
| Optional fast path | Speech-to-speech realtime model adapter (`S2sProvider`) | Lower latency, less control |
| Meeting bots | Interface `MeetingBotProvider`; default adapter Recall.ai | Zoom / Meet / Teams |
| Tests | Vitest, Playwright, MSW | |
| Lint/format | ESLint, Prettier | |
| Infra | Docker Compose (postgres, redis, livekit) | |
| CI | GitHub Actions: lint, typecheck, test, build | |

## Rules
- Never pin a model name in code. Use env: `STT_MODEL`, `TRANSLATE_MODEL`, `TTS_MODEL`, `TTS_VOICE_MALE`, `TTS_VOICE_FEMALE`.
- Use latest stable major versions of libraries at install time; commit the lockfile.
- A vendor can be replaced by writing one adapter file and changing one env value.

## Environment variables (`.env.example` must include all)
```
DATABASE_URL= REDIS_URL= JWT_SECRET= APP_URL= API_URL=
GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET=
STT_PROVIDER=deepgram STT_API_KEY= STT_MODEL=
TRANSLATE_PROVIDER=anthropic TRANSLATE_API_KEY= TRANSLATE_MODEL=
TTS_PROVIDER=elevenlabs TTS_API_KEY= TTS_MODEL= TTS_VOICE_MALE= TTS_VOICE_FEMALE=
MEETING_BOT_PROVIDER=recall MEETING_BOT_API_KEY= MEETING_BOT_REGION=
LIVEKIT_URL= LIVEKIT_API_KEY= LIVEKIT_API_SECRET=
STRIPE_SECRET_KEY= STRIPE_WEBHOOK_SECRET=
```
