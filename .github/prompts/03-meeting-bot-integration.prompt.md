---
mode: agent
description: Phase 03 - Meeting Bot Mode for Google Meet, Zoom, MS Teams
---
# Phase 03 — Meeting Bot Mode
Read: docs/02-architecture.md (Meeting Bot flow), docs/06-security-rules.md (items 8, 9), docs/10-api-contracts.md.

## Task
1. `providers/meeting-bot`: interface `MeetingBotProvider` {createBot, getStatus, leave, onAudio(participant stream), sendAudio}. Adapter `recall.ts` (HTTP + WebSocket + webhook signature verification).
2. Module `bots`: REST `POST/GET/DELETE /v1/bots`, webhook `/v1/webhooks/meeting-bot`, WebSocket ingest `/v1/ws/bot/:botId` feeding the Phase 02 pipeline; translated audio goes back through `sendAudio`.
3. Bot display name and avatar come from user Settings. Status machine: joining → waiting_admit → in_call → ended | denied. Never bypass admission.
4. Web: page `meeting-bot` (form, status stepper, live caption feed, dock controls per docs/09). Mock vendor adapter for local dev (`MEETING_BOT_PROVIDER=mock`) that replays a sample conversation.
5. Echo guard: ignore audio attributed to the bot itself.

## Definition of Done
With `mock` provider the full UI flow works end to end; with real keys a bot joins a Google Meet after host admission, and speaks translated audio.
