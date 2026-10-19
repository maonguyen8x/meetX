# 04 — Folder Structure (authoritative)

```
interpreter-ai/
├── AGENTS.md  README.md  package.json  pnpm-workspace.yaml  turbo.json  .env.example  .gitignore
├── setup-structure.sh  setup-structure.ps1
├── .github/
│   ├── copilot-instructions.md
│   ├── prompts/                      # phase prompts 00..15
│   └── workflows/ (ci.yml, deploy.yml)
├── docs/                             # specs 00..19
├── infra/
│   ├── docker-compose.yml            # dev: postgres(pgvector), redis, minio, livekit, mailpit
│   ├── docker-compose.prod.yml       # prod stack
│   ├── caddy/Caddyfile
│   └── scripts/ (backup.sh, restore.sh, deploy.sh)
├── packages/
│   ├── shared/src/
│   │   ├── languages.ts  permissions.ts  roles.ts  plans.ts
│   │   ├── schemas/                  # zod: auth, user, org, settings, meeting, knowledge, billing, events
│   │   ├── types/
│   │   └── index.ts
│   └── config/                       # eslint, tsconfig, prettier presets
├── apps/
│   ├── api/
│   │   ├── prisma/ (schema.prisma, migrations/, seed.ts)
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── main.ts  app.ts  worker.ts
│   │       ├── config/ (env.ts, pricing.ts)
│   │       ├── db/ (prisma.ts, redis.ts)
│   │       ├── authorization/ (policy.ts, permissions.seed.ts, guards.ts)
│   │       ├── plugins/ (auth, cors, rate-limit, helmet, error-handler, swagger, audit)
│   │       ├── modules/
│   │       │   ├── auth/  users/  organizations/  admin/  audit/
│   │       │   ├── settings/  meetings/  glossary/  memory/  export/  bots/  rooms/
│   │       │   ├── knowledge/
│   │       │   │   ├── folders/  documents/  access/  conversations/
│   │       │   │   ├── ingestion/ (queue.ts, pipeline.ts)
│   │       │   │   ├── parsers/ (pdf.ts docx.ts xlsx.ts pptx.ts html.ts text.ts)
│   │       │   │   ├── chunking/  retrieval/ (hybrid.ts, rerank.ts)
│   │       │   │   └── answer/ (rag.ts, deep-search.ts, prompts/)
│   │       │   ├── billing/ (plans, subscriptions, invoices, payments, wallet, webhooks)
│   │       │   ├── usage/ (metering, quotas)
│   │       │   └── notifications/
│   │       ├── jobs/ (renewal-scan, reminder-scan, dunning-retry, quota-check, reconcile, scheduler.ts)
│   │       ├── realtime/
│   │       │   ├── gateway.ts  session.ts
│   │       │   └── pipeline/ (orchestrator, vad, endpointing, context-builder, segmenter, emotion-tagger)
│   │       ├── providers/
│   │       │   ├── stt/  translate/ (prompts/)  tts/  meeting-bot/
│   │       │   ├── embedding/  web-search/  payment/  mailer/  storage/  ocr/
│   │       ├── integrations/livekit/ (token.ts, agent.ts)
│   │       └── utils/ (logger, crypto, audio, errors, time, pagination)
│   └── web/
│       ├── Dockerfile
│       └── src/
│           ├── middleware.ts         # locale + route guards
│           ├── app/[locale]/
│           │   ├── (marketing)/  (auth)/ login register forgot-password accept-invite
│           │   ├── dashboard/ (page.tsx, knowledge/)
│           │   ├── documents/ [[...folderId]]
│           │   ├── meeting-bot/  room/[id]/  history/
│           │   ├── billing/  usage/  notifications/
│           │   ├── settings/ (profile, interpreter, languages, memory, knowledge, privacy, notifications, security, appearance)
│           │   ├── org/ (members, quotas, profile, billing)
│           │   └── admin/ (overview, users, orgs, plans, subscriptions, usage, moderation, audit, system)
│           ├── components/ui/        # shadcn primitives
│           ├── components/           # app-shell, glass-card, interpreter-avatar, caption-feed, charts, can.tsx
│           ├── features/             # knowledge, documents, bot-session, room, settings, billing, admin, org, notifications
│           ├── hooks/                # useMicStream, useRealtimeSocket, useAudioDucking, usePermissions, useSSE
│           ├── lib/                  # api-client, auth, audio/worklet, i18n, utils
│           ├── stores/
│           ├── messages/             # vi.json en.json ja.json
│           └── styles/globals.css
└── tests/e2e/                        # Playwright (per-role flows)
```
Rules: one responsibility per file; max ~250 lines per file; feature code stays inside its module/feature folder.
