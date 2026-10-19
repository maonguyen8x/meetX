# Interpreter AI

Real-time voice-to-voice interpretation (vi / ja / en), knowledge search, accounts, and billing.

## Local development

Requirements: Node.js 22, pnpm 9, and Docker Desktop.

In PowerShell:

```powershell
Copy-Item .env.example .env
# Set SEED_SUPER_ADMIN_PASSWORD in .env before seeding the database.
pnpm install
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The web app serves on http://localhost:3000 (Vietnamese, English, and Japanese routes at `/vi`, `/en`, and `/ja`). The API listens on http://localhost:4000; check `/health` and `/ready` for health and dependency readiness.

For a non-default embedding model dimension, set `EMBEDDING_DIM` first, start the database, then run `pnpm db:set-embedding-dim` before the first migration. This changes the initial migration only; changing the dimension after migration requires a new migration.

Run quality checks with `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. Start with [the getting started guide](docs/00-getting-started-guide.md); implementation phases and specs are listed in `.github/prompts/` and `docs/`.
