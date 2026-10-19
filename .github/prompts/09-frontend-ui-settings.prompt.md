---
mode: agent
description: Phase 09 - Frontend UI/UX polish and settings
---
# Phase 09 — Frontend UI/UX, Settings, Layout
Read: docs/09-ui-ux-spec.md, docs/05-coding-conventions.md.

## Task
Implement all screens in docs/09: Landing/Login, Dashboard, Settings (Interpreter persona with avatar crop + voice preview, Languages & Triggers, Memory & Glossary, Privacy & Storage, Billing, Appearance), History (search, detail, download md/json), shared components (`InterpreterAvatar` with speaking animation, `CaptionFeed`, `ControlDock`, `UsageChip`).
Apply design tokens, spacing, 44px tap targets, dark/light themes, reduced-motion support, skeletons, empty states, error states, mobile layouts. All strings via next-intl (vi/en/ja).

## Definition of Done
Lighthouse accessibility ≥ 95 on main screens; no hardcoded strings; Playwright smoke test navigates every screen.
