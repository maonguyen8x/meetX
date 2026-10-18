# AGENTS.md — Project Entry Point (read first)

## Project
**Interpreter AI**: a real-time, voice-to-voice multilingual AI interpreter (priority languages: Vietnamese `vi`, Japanese `ja`, English `en`; extensible).
Two products sharing one core pipeline:
1. **Meeting Bot Mode** — joins Google Meet / Zoom / MS Teams as a participant and interprets for the user.
2. **Standalone Meeting Mode** — own WebRTC video-meeting app; every participant speaks and hears their own language.

## How to work (IMPORTANT — saves request quota)
- Work **one phase at a time** using `.github/prompts/NN-*.prompt.md`. Never start the next phase before the current phase's "Definition of Done" passes.
- Do NOT re-read the whole repo. Read only: this file, `.github/copilot-instructions.md`, and the docs the active prompt lists.
- Generate complete, compilable files in one pass. No placeholders like `// TODO implement`, except where the prompt allows.
- After each phase: run `pnpm lint && pnpm typecheck && pnpm test`, fix errors, then commit with Conventional Commits.

## Docs map
| File | Purpose |
|---|---|
| docs/01-product-requirements.md | What to build |
| docs/02-architecture.md | System design and data flow |
| docs/03-tech-stack.md | Exact technologies and versions policy |
| docs/04-folder-structure.md | Source tree (authoritative) |
| docs/05-coding-conventions.md | Style rules |
| docs/06-security-rules.md | Mandatory security rules |
| docs/07-translation-voice-spec.md | Interpreter behavior, emotion, voice |
| docs/08-billing-pricing.md | Usage metering and pricing |
| docs/09-ui-ux-spec.md | Design system and screens |
| docs/10-api-contracts.md | REST/WebSocket contracts |
| docs/11-testing-strategy.md | Tests and demo script |
| docs/12-decisions-faq.md | Answers to open product questions |

## Commands
```
pnpm install            # install
pnpm dev                # web + api in parallel
pnpm infra:up           # postgres, redis, livekit via docker compose
pnpm db:migrate         # prisma migrate dev
pnpm lint | typecheck | test | build
```
