---
mode: agent
description: Phase 04 - Standalone video meeting with built-in interpreter
---
# Phase 04 — Standalone Meeting Mode
Read: docs/02-architecture.md (Standalone flow), docs/09-ui-ux-spec.md (Room), docs/06-security-rules.md.

## Task
1. `integrations/livekit`: token endpoint `POST /v1/rooms/:id/token` (grants + metadata speakLang/listenLang); rooms CRUD.
2. Interpreter agent (`agent.ts`): server worker that joins each active room, subscribes to every speaker track, runs the pipeline per speaker, publishes one translated audio track per needed target language (`interp-<lang>`).
3. Web `room/[id]`: LiveKit React components; pre-join screen (device test, speak/listen language); video grid; control bar; captions overlay; interpreter badge + consent indicator visible to all; `useAudioDucking` lowers original tracks and plays `interp-<listenLang>`; chat drawer; host controls (mute all, end).
4. Invite link sharing, room lobby, reconnect handling.

## Definition of Done
Two browser tabs with different speak/listen languages hear translated voice and see captions; usage ticker updates.
