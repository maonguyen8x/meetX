# 12 — Product Decisions & FAQ

1. **Do participants still hear original voices in Google Meet/Zoom/Teams?** Yes. The bot is an additional participant; original speech stays. The bot speaks translated audio on top. In Standalone mode the app ducks original audio to `duckOriginalPct` (default 15%) so translation is clear.
2. **Pricing:** prepaid pay-as-you-go credits with markup (see 08). No unlimited flat plan.
3. **UI:** see 09.
4. **Translation technology:** streaming STT → LLM translation with context and style tags → streaming expressive TTS. Languages in v1: vi, ja, en. Complexity is contained by provider interfaces.
5. **Host permission:** Bot Mode: yes — the bot joins as a participant and the host must admit it (Meet admission, Zoom waiting room / app policy, Teams lobby). If denied, the bot cannot join (status `denied`). Standalone Mode: no external host needed; the room owner controls it. Always inform participants that an AI interpreter is active.
6. **Recommended usage:** default trigger mode `auto` with `endpointingMs=700`; use `manual` for noisy rooms; use headphones to avoid echo; set glossary before important meetings.
7. **Storage:** per-meeting `.md/.json` downloadable locally; optional cloud sync after explicit opt-in.
