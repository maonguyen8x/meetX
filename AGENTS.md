# AGENTS.md — Project Entry Point (read first)

## Project
**Interpreter AI**: a SaaS platform with four products on one core:
1. **Meeting Bot Mode** — joins Google Meet / Zoom / MS Teams and interprets voice-to-voice (vi, ja, en first).
2. **Standalone Meeting Mode** — own WebRTC meeting app with built-in AI interpreter.
3. **Knowledge Base & AI Search (RAG)** — folders, file upload, file info, cited answers (UI reference: docs/17).
4. **Accounts, Organizations, Admin & Billing** — Super Admin / Admin / User / Enterprise roles, plans per day/week/month/year, quotas, auto-renew.

## How to work (IMPORTANT — saves request quota)
- Start with `docs/00-getting-started-guide.md`.
- Work **one phase at a time** with `.github/prompts/NN-*.prompt.md` (00 → 15). New chat per phase. Do not start the next phase before the current "Definition of Done" passes.
- Read only: this file, `.github/copilot-instructions.md`, and the docs the active prompt lists. Do NOT re-read the whole repo.
- Output complete, compilable files. No placeholder `// TODO implement` unless the prompt allows.
- After each phase run `pnpm lint && pnpm typecheck && pnpm test`, fix errors, commit with Conventional Commits.
- When requirements conflict, priority: docs/06 security > docs/14 RBAC > docs/13 database > feature docs > this file.

## Docs map
| File | Purpose |
|---|---|
| docs/00-getting-started-guide.md | Step-by-step guide from zero to production |
| docs/01-product-requirements.md | What to build |
| docs/02-architecture.md | System design, realtime flow |
| docs/03-tech-stack.md | Technologies, env vars |
| docs/04-folder-structure.md | Source tree (authoritative) |
| docs/05-coding-conventions.md | Style rules |
| docs/06-security-rules.md | Mandatory security rules |
| docs/07-translation-voice-spec.md | Interpreter behavior, emotion, voice |
| docs/08-billing-pricing.md | Credit metering formula |
| docs/09-ui-ux-spec.md | Global design system |
| docs/10-api-contracts.md | REST/WebSocket contracts |
| docs/11-testing-strategy.md | Tests and demo script |
| docs/12-decisions-faq.md | Product decisions |
| docs/13-database-design.md | Full database schema |
| docs/14-rbac-accounts-organizations.md | Roles, permissions, organizations |
| docs/15-subscription-billing-autorenew.md | Plans, quotas, auto-renew, notifications |
| docs/16-knowledge-base-rag.md | Folders, upload, ingestion, RAG |
| docs/17-ui-knowledge-dashboard.md | Knowledge/Documents UI like the reference image |
| docs/18-admin-panel-spec.md | Admin, org admin, settings |
| docs/19-deployment-production.md | Build and deploy to production |

## Commands
```
pnpm install | pnpm dev | pnpm infra:up | pnpm infra:down
pnpm db:migrate | pnpm db:seed | pnpm db:studio
pnpm lint | typecheck | test | build | test:e2e
```
