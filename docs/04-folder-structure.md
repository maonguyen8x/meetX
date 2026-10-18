# 04 — Folder Structure (authoritative)

```
interpreter-ai/
├── AGENTS.md  README.md  package.json  pnpm-workspace.yaml  turbo.json  .env.example  .gitignore
├── .github/
│   ├── copilot-instructions.md
│   ├── prompts/                      # phase prompts 00..08
│   └── workflows/ci.yml
├── docs/                             # specs 01..12
├── infra/docker-compose.yml          # postgres, redis, livekit
├── packages/
│   ├── shared/src/
│   │   ├── languages.ts              # supported languages + metadata
│   │   ├── schemas/                  # zod schemas (settings, meeting, events, usage)
│   │   ├── types/
│   │   └── index.ts
│   └── config/                       # eslint, tsconfig, prettier presets
├── apps/
│   ├── api/
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   │       ├── main.ts  app.ts
│   │       ├── config/env.ts
│   │       ├── db/ (prisma client, redis client)
│   │       ├── plugins/ (auth, cors, rate-limit, error-handler, swagger)
│   │       ├── modules/
│   │       │   ├── auth/  users/  settings/  meetings/
│   │       │   ├── memory/        # summary, glossary, recap
│   │       │   ├── usage/  billing/
│   │       │   └── export/        # md/json export
│   │       ├── realtime/
│   │       │   ├── gateway.ts  session.ts
│   │       │   └── pipeline/ (orchestrator, vad, endpointing, context-builder, segmenter, emotion-tagger)
│   │       ├── providers/
│   │       │   ├── stt/ (types.ts, deepgram.ts, index.ts)
│   │       │   ├── translate/ (types.ts, anthropic.ts, openai.ts, prompts/, index.ts)
│   │       │   ├── tts/ (types.ts, elevenlabs.ts, openai.ts, index.ts)
│   │       │   └── meeting-bot/ (types.ts, recall.ts, index.ts)
│   │       ├── integrations/livekit/ (token.ts, agent.ts)
│   │       └── utils/ (logger, audio, errors, time)
│   └── web/
│       └── src/
│           ├── app/ ([locale]/ (marketing)/ (auth)/ dashboard/ meeting-bot/ room/[id]/ settings/ usage/ history/)
│           ├── components/ui/        # shadcn primitives
│           ├── components/           # layout, interpreter-avatar, caption-feed, controls, charts
│           ├── features/             # bot-session, room, settings, usage, history
│           ├── hooks/                # useMicStream, useRealtimeSocket, useAudioDucking
│           ├── lib/                  # api-client, audio/worklet, i18n, utils
│           ├── stores/               # zustand stores
│           ├── messages/             # vi.json en.json ja.json
│           └── styles/globals.css
└── tests/e2e/                        # Playwright
```
Rules: one responsibility per file; max ~250 lines per file; feature code stays inside its module/feature folder.
