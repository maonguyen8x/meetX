---
mode: agent
description: Phase 12 - Meeting memory, summaries, recap, export
---
# Phase 12 — Memory & Summaries
Read: docs/07-translation-voice-spec.md (Memory, Modes), docs/01-product-requirements.md.

## Task
1. Rolling summary job (every 5 turns or 90 s) using a cheap model; glossary auto-extraction of proper nouns; previous-meeting context lookup by customer tag.
2. Modes `summarize_turn`, `recap` (gentle, polite), `reply_as_assistant` (only when addressed by persona name) wired into the pipeline and WebSocket (`recap.request`).
3. End-of-meeting summary: key points, decisions, action items, in the user's language; saved with the meeting.
4. Export: `.md` and `.json` per meeting (`modules/export`); web "Download" and, for local storage mode, File System Access API with fallback to download; opt-in cloud sync to object storage.
5. Privacy controls: Save history toggle, per-meeting delete, account-wide delete.

## Definition of Done
After a demo meeting, History shows summary + action items; exported `.md` is well-formed; recap button produces a polite recap.
