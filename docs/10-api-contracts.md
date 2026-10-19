# 10 — API Contracts (all schemas defined with Zod in `packages/shared/src/schemas`)

Base: `/v1`. JSON. Errors: `{ "error": { "code": string, "message": string } }`.

## REST
| Method | Path | Purpose |
|---|---|---|
| POST | /auth/refresh | Refresh JWT |
| GET/PATCH | /me | Profile |
| GET/PATCH | /settings | InterpreterSettings (name, avatarUrl, voiceGender, voiceStyle, speed, duckOriginalPct, triggerMode, endpointingMs, defaultPair, saveHistory, storageMode) |
| POST | /settings/avatar | Multipart upload |
| POST | /settings/voice-preview | `{lang}` → audio sample |
| POST | /bots | `{meetingUrl, platform, sourceLang, targetLang, triggerMode}` → `{botId, status}` |
| GET | /bots/:id | Status (`joining, waiting_admit, in_call, ended, denied`) |
| DELETE | /bots/:id | Leave meeting |
| POST | /rooms | Create room |
| POST | /rooms/:id/token | LiveKit token `{speakLang, listenLang, displayName}` |
| GET | /meetings | List history |
| GET | /meetings/:id | Detail (turns, summary) |
| GET | /meetings/:id/export?format=md\|json | Download |
| DELETE | /meetings/:id | Delete |
| GET/POST | /glossary | CRUD terms |
| GET | /usage/summary?range=day\|month\|year | Totals + series |
| GET | /usage/balance | Credits + estimated minutes |
| POST | /billing/checkout | Stripe checkout session |
| POST | /billing/webhook | Stripe webhook (signature verified) |

## WebSocket `/v1/ws/session?token=...`
Client → Server
- `{type:"session.start", sourceLang, targetLang, mode, meetingId?}`
- binary frames: PCM16 mono 16 kHz, 20 ms
- `{type:"translate.now"}`, `{type:"mute.interpreter", on:boolean}`, `{type:"recap.request"}`, `{type:"session.end"}`
Server → Client
- `{type:"turn.start", turnId, speaker, lang}`
- `{type:"caption.partial|caption.final", turnId, text, lang}`
- `{type:"translation.text", turnId, text, lang, emotion?}`
- binary frames tagged by preceding `{type:"translation.audio.start", turnId, format:"pcm16", sampleRate:24000}` and `{type:"translation.audio.end", turnId}`
- `{type:"usage.tick", creditsUsed, balance, minutesLeft}`
- `{type:"error", code, message}`

## Webhooks from meeting-bot vendor
`POST /v1/webhooks/meeting-bot` (signature verified): status changes (`joining`, `in_call`, `ended`, `denied`) → update bot record and notify client.

## Additional endpoints (added)
Auth/Accounts: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/verify-email`, `GET /auth/sessions`, `DELETE /auth/sessions/:id`.
Admin (permission-guarded, docs/14, 18): `GET/POST /admin/users`, `GET/PATCH/DELETE /admin/users/:id`, `POST /admin/users/:id/activate|deactivate|role|permissions|reset-password|force-logout`, `POST /admin/admins`, `GET/POST /admin/orgs`, `PATCH/DELETE /admin/orgs/:id`, `GET /admin/audit-logs`, `GET/PATCH /admin/system-settings`, `GET /admin/overview`.
Organizations: `GET/POST /orgs`, `GET/PATCH /orgs/:id`, `POST /orgs/:id/invitations`, `POST /orgs/invitations/accept`, `GET /orgs/:id/members`, `PATCH/DELETE /orgs/:id/members/:userId`, `PUT /orgs/:id/members/:userId/quotas`.
Billing: `GET /plans`, `GET /billing/account`, `GET/POST /billing/subscription`, `PATCH /billing/subscription` (plan, interval, interval_count, auto_renew, on_expiry_action, cancel_at_period_end), `POST /billing/subscription/renew-now`, `GET /billing/quotas`, `GET /billing/invoices`, `POST /billing/invoices/:id/pay`, `GET/POST/DELETE /billing/payment-methods`, `POST /billing/wallet/topup`, `GET /usage/summary?range=day|week|month|year|custom&from=&to=&groupBy=kind|member`.
Notifications: `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `GET/PUT /notifications/preferences`, SSE `GET /notifications/stream`.
Knowledge: see docs/16.
