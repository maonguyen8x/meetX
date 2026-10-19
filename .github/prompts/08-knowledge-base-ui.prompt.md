---
mode: agent
description: Phase 08 - Knowledge base UI matching the reference image
---
# Phase 08 — Knowledge Dashboard & Documents UI
Read: docs/17-ui-knowledge-dashboard.md (authoritative; replicate the reference image layout, not its placeholder text), docs/16-knowledge-base-rag.md (API), docs/09-ui-ux-spec.md, docs/05-coding-conventions.md.

## Task
Build, with real API integration:
1. App shell + glass card system (teal gradient background, rounded glass cards, light/dark) reusable across pages: top bar (logo "AI SEARCH", nav pills, bell, avatar dropdown with org switcher, language, theme, sign out).
2. `/dashboard/knowledge`: search bar with 3 toggle buttons (Web Search, Thinking, Deep Search), folder-scope chip, two-column layout: Source Documents + Document Chunks (left), AI-Generated Answer with streaming markdown and clickable citation chips + References (right). Deep Search progress list, empty/loading/error states, responsive tabs on mobile. Hook `useKnowledgeSearch` consuming SSE.
3. `/documents`: folder tree (drag & drop move, context menu, visibility badges), document table/grid with status badges and progress, multi-select toolbar, upload dropzone + queue with progress/cancel/retry/validation (presigned upload), URL import, storage meter, trash view.
4. File Info drawer with tabs Details | Preview | Chunks | Versions | Access (status timeline, PDF/text preview, chunk search, grants management, actions).
5. Real-time status via SSE (`document.status`), toast notifications, keyboard accessibility, i18n (vi/en/ja) for every string.

## Tests
Component tests for citation chips and upload queue; Playwright: upload → READY → ask → click citation → file drawer opens.

## Definition of Done
Layout is recognizably identical to the reference (card order, toggles, citation chips, references); Lighthouse accessibility ≥ 95; Playwright flow passes.
