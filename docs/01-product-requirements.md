# 01 — Product Requirements

## Personas
- **Interpreter/Business user (Host)**: speaks Vietnamese with Japanese/English clients; needs an assistant that works like a human interpreter.
- **Meeting participant**: speaks any supported language, wants to understand others without knowing their language.

## Product A — Meeting Bot Mode
- A1. User pastes a Google Meet / Zoom / Teams link; the "Interpreter" bot joins as a named participant with a custom avatar.
- A2. Bot listens to speakers, detects language (vi/ja/en), translates, and speaks the translation into the meeting (voice-to-voice) AND shows live captions in the app.
- A3. Trigger modes (setting `triggerMode`):
  - `auto` (default): translate after silence ≥ `endpointingMs` (default 700 ms) or a closing cue ("nhờ bạn dịch", "please translate", "お願いします").
  - `manual`: translate only when the user presses the Translate button (icon).
  - `summary`: after the other side finishes a turn, speak/show a short summary.
- A4. Direction is automatic: Vietnamese speaker → Japanese audience; Japanese speaker → Vietnamese for the user. Configurable language pair per meeting.
- A5. Bot only joins if the meeting host admits it (see 12-decisions-faq.md).

## Product B — Standalone Meeting Mode
- B1. Create/join a room by link; WebRTC video + audio (LiveKit).
- B2. Each participant chooses `speakLanguage` and `listenLanguage`. They hear the translated voice (original voice ducked to ~15%) and see translated captions.
- B3. Room features: mute/camera/screen share, participant list, chat, host controls, recording toggle (consent banner).

## Shared features
- Interpreter persona: name, avatar (upload), voice gender (male/female/neutral) and voice style in Settings.
- Emotional, natural speech (see 07-translation-voice-spec.md).
- Meeting memory: rolling summary, glossary, previous-meeting context; polite reminders ("Gentle recap") when a user missed information.
- Transcripts + summaries saved as per-meeting `.md` and `.json`: download to local device, or sync to cloud account storage (opt-in).
- Usage dashboard: tokens/minutes used, balance, cost by day/month/year (see 08-billing-pricing.md).
- Auth (email + Google), roles (`USER`, `ADMIN`), i18n UI (vi/en/ja).

## Product C — Knowledge Base & AI Search (RAG)
- C1. Folder management, file upload (PDF/DOCX/XLSX/PPTX/CSV/MD/TXT/HTML/URL), file info panel. Details: docs/16, UI: docs/17.
- C2. Ask questions in natural language; answers cite sources `[1][2]`; modes Web Search, Thinking, Deep Search.

## Product D — Accounts, Organizations, Admin, Billing
- D1. Roles: Super Admin, Admin, User, Enterprise (ORG_ADMIN, ORG_MEMBER). Details: docs/14. Admin panel: docs/18.
- D2. Plans per DAY/WEEK/MONTH/YEAR/custom cycle, quota tracking (minutes, tokens, storage), auto-renew or user-chosen expiry action, reminders. Details: docs/15.
- D3. Database: docs/13.

## Non-functional
- End-to-end latency target (speech end → translated audio start): ≤ 2.0 s p50, ≤ 3.5 s p95.
- Works on desktop Chrome/Edge/Safari and mobile web. WCAG AA contrast.
- 99% of WebSocket reconnects recover within 5 s without losing session state.

## Out of scope (v1)
Native mobile apps, offline mode, more than 6 simultaneous languages per room.
