# 09 — UI/UX Specification

## Visual language
Modern, calm, premium. Rounded (`rounded-2xl` cards, `rounded-full` main buttons), soft shadows, glass panels on dark gradient for meeting screens. Light and dark themes (system default).

## Design tokens
- Fonts: Inter (UI), Noto Sans JP (Japanese), `font-feature-settings: "cv11","ss01"`. Base 16 px, line-height 1.5.
- Spacing scale 4/8/12/16/24/32/48; section padding 24–32; button gap ≥ 12; min tap 44×44.
- Colors (CSS variables): `--primary` indigo-600, `--accent` teal-500, `--bg` slate-50 / slate-950, `--surface` white / slate-900, `--danger` rose-500, `--success` emerald-500. Contrast ≥ 4.5:1.
- Motion: Framer Motion, 150–250 ms ease-out; respect `prefers-reduced-motion`.

## Screens
1. **Landing/Login** — hero, language switcher, Google sign-in.
2. **Dashboard** — two big cards: "Join external meeting (Bot)" and "Start my own meeting"; recent meetings; balance chip.
3. **Bot Session** — paste link, language pair, trigger mode (Auto/Manual/Summary), Start. Live view:
   - Left: interpreter avatar (animated ring when speaking), name, status.
   - Center: two-column caption feed (original / translated) with speaker chips and emotion icons.
   - Bottom dock: big round **Translate now** button, Mute interpreter, Replay last, Recap, End.
   - Top right: usage ticker (min used / balance).
4. **Room (Standalone)** — video grid, floating control bar, language selectors (speak/listen), caption overlay, interpreter badge, consent indicator, chat drawer.
5. **Settings** — tabs: Interpreter (name, avatar upload with crop, voice gender/style/speed, preview), Languages & Triggers, Memory & Glossary, Privacy & Storage (local/cloud), Billing, Appearance & Language.
6. **History** — list, search, open meeting: transcript, summary, action items; Download `.md` / `.json`.
7. **Usage** — per 08-billing-pricing.md.

## UX rules
- Caption text 18–22 px, translated line emphasized; auto-scroll with "Jump to live" pill.
- Skeletons and optimistic updates; every error has a retry action and a plain-language message in the user's UI language.
- Mic permission explainer before browser prompt.
- Mobile: bottom sheet controls, single-column captions.
- Empty states have an illustration and one clear call to action.
