# 00 — Getting Started Guide (from zero to a running production system)

Follow top to bottom. Do not skip the "Verify" lines.

## Stage 0 — Prepare the machine (once)
Install: Node.js 22 LTS, pnpm (`npm i -g pnpm`), Git, Docker Desktop, VS Code + GitHub Copilot + Copilot Chat (Agent mode).
Verify: `node -v` (v22.x), `pnpm -v`, `docker -v`, `git --version`, Docker Desktop shows "running".
Windows tips: use **Git Bash** or **WSL** for bash commands; in PowerShell use `Copy-Item .env.example .env` instead of `cp`.

## Stage 1 — Open the project
1. VS Code → File → Open Folder → the project root (the folder containing `AGENTS.md` and `.github`).
2. `git init` and first commit (if not done).
3. Run `bash setup-structure.sh` (or `powershell -ExecutionPolicy Bypass -File setup-structure.ps1`) to create empty folders.

## Stage 2 — Build with Copilot, phase by phase
Open Copilot Chat → mode **Agent** → type `/` and choose the prompt (or open the prompt file and paste its body). Use a **new chat for every phase**. After each phase run the "Verify" commands, fix errors by pasting the error text to Copilot, then commit.

| # | Prompt file | What you get | Accounts/keys needed first | Verify |
|---|---|---|---|---|
| 0 | `00-bootstrap` | Monorepo, web/api skeleton, docker infra, CI | none | `cp .env.example .env` → `pnpm install` → `pnpm infra:up` → `pnpm db:migrate` → `pnpm dev`; open web + `/health` |
| 1 | `01-database-schema` | Full Prisma schema, migrations, pgvector, seed | Set `SEED_SUPER_ADMIN_PASSWORD` in `.env` | `pnpm db:migrate && pnpm db:seed`; `pnpm --filter @meetx/api test:integration`; `pnpm db:studio` shows tables |
| 2 | `02-auth-rbac-organizations` | Login, roles, orgs, permission checks, audit logs | Google OAuth (optional at first; email login works without) | log in as seeded Super Admin; RBAC tests pass |
| 3 | `03-backend-core` | Settings, persona, meetings, glossary, export | none | API tests pass; `/docs` swagger |
| 4 | `04-realtime-pipeline` | Voice-to-voice translation engine | STT, LLM, TTS keys (or fake providers) | `pnpm --filter api demo:cli` outputs translated audio |
| 5 | `05-standalone-meeting` | Own video meeting with interpreter | LiveKit (docker) | two browser tabs hear translation |
| 6 | `06-meeting-bot` | Bot for Meet/Zoom/Teams | Recall.ai (or `mock`) | mock flow works; real Meet after host admits |
| 7 | `07-knowledge-base-backend` | Folders, upload, ingestion, hybrid search, cited answers | Embedding + LLM keys, MinIO (docker) | upload a PDF → READY → ask question via API |
| 8 | `08-knowledge-base-ui` | Dashboard + Documents UI like the reference image | none | upload → search → citations → file drawer |
| 9 | `09-frontend-ui-settings` | App shell, landing, settings, history, i18n | none | all screens in vi/en/ja |
| 10 | `10-admin-panel` | Super Admin / Admin / Org admin panels | none | Playwright per-role tests pass |
| 11 | `11-subscription-billing` | Plans, quotas, invoices, auto-renew, payments | Stripe test keys + Stripe CLI | test card `4242 4242 4242 4242`; DAY plan auto-renews |
| 12 | `12-memory-summary` | Summaries, recap, glossary learning | none | meeting ends with summary + `.md` export |
| 13 | `13-notifications-and-jobs` | Reminders, quota alerts, dunning, email | SMTP/Resend (optional in dev: console mailer) | reminders and 80/90/100% alerts fire |
| 14 | `14-testing-hardening` | Tests, security pass, seed demo | none | `pnpm lint typecheck test build` + e2e green |
| 15 | `15-production-deployment` | Dockerfiles, compose.prod, Caddy, CI deploy, runbook | server + domains | `docker compose -f infra/docker-compose.prod.yml up -d` on server |

Recommended order for a fast first demo: 0 → 1 → 2 → 3 → 4 → 5 → 9 → 7 → 8 → 10 → 11 → 13 → 12 → 6 → 14 → 15.

## Stage 3 — Accounts & keys (register only when the phase needs them)
- **Google OAuth** (phase 2): Google Cloud Console → new project → OAuth consent screen (External, add yourself as test user) → Credentials → OAuth client ID (Web) → redirect `http://localhost:3000/api/auth/callback/google` → copy ID/secret to `.env`.
- **Deepgram** (phase 4): console.deepgram.com → API Keys → `STT_API_KEY`. First verify vi/ja streaming support for the chosen model.
- **LLM** (phases 4, 7): Anthropic or OpenAI key → `TRANSLATE_*`, `ANSWER_*`.
- **ElevenLabs** (phase 4): API key → `TTS_API_KEY`; choose male/female voice IDs that support vi/ja/en.
- **Embeddings** (phase 7): choose a multilingual model; set `EMBEDDING_*` and keep `EMBEDDING_DIM` equal to the model output size.
- **Web search** (phase 7, optional): Tavily or Brave key → `WEB_SEARCH_*`.
- **LiveKit** (phase 5): local docker keys from `infra/docker-compose.yml` for dev.
- **Recall.ai** (phase 6): API key + region; public webhook via `ngrok http 4000` in dev.
- **Stripe** (phase 11): test-mode secret key; `stripe listen --forward-to localhost:4000/v1/billing/webhook` gives `STRIPE_WEBHOOK_SECRET`.
- **Secrets you generate yourself**: `JWT_SECRET`, `DATA_ENCRYPTION_KEY` → `openssl rand -base64 32` (or Node: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).

## Stage 4 — Working rules with Copilot (saves quota)
- One phase = one new chat = one branch (`phase/NN-name`) = one commit/PR.
- If Copilot stops: *"Continue phase NN from where you stopped. Do not redo finished files."*
- If it deviates: *"Follow docs/04-folder-structure.md and docs/13-database-design.md exactly."*
- Change requirements by editing the docs, then re-run the phase prompt for that change.
- Never paste secrets into chat.

## Stage 5 — Final acceptance
Run the demo script in `docs/11-testing-strategy.md`, then the RBAC and billing acceptance tests, then follow `docs/19-deployment-production.md` and its go-live checklist.

## Common errors
| Symptom | Fix |
|---|---|
| `ERR_PNPM_NO_PKG_MANIFEST` | You are not in the project root or phase 00 not done |
| `cp` not found (PowerShell) | `Copy-Item .env.example .env` |
| `pnpm infra:up` fails | Start Docker Desktop; check ports 5432/6379/7880 are free |
| Prisma: extension "vector" not available | Use the `pgvector/pgvector` Postgres image in compose |
| `EADDRINUSE` | Another process uses the port; change port in `.env` or stop it |
| Embedding dimension mismatch | Make `EMBEDDING_DIM` equal to model size, recreate the vector column via migration |
| OAuth `redirect_uri_mismatch` | Redirect URI in Google console must match exactly |
