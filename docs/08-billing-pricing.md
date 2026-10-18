# 08 — Usage Metering & Pricing

## Principle
**Pay-as-you-go prepaid wallet** (no flat unlimited plan) so cost never exceeds revenue. Users see simple units: **minutes of interpretation** (primary) and **tokens/credits** (detail view).

## Metering (every provider call writes a `usage_events` row)
Fields: `userId, meetingId, kind(stt|llm_in|llm_out|tts|bot|video), quantity, unit(sec|token|char|min), providerCostUsd, creditsCharged, createdAt`.

## Credit formula
```
providerCost  = Σ vendor_unit_price × quantity   (prices in config/pricing.ts, env-overridable)
creditsCharged = ceil( providerCost × MARKUP / CREDIT_USD )
MARKUP = 2.5 (default, configurable) ; CREDIT_USD = 0.01
```
Display: "≈ N minutes left" = balance ÷ rolling average credits/min of the user (default estimate if no history).

## Products to sell
1. **Top-up packs** (Stripe Checkout): e.g. 10 / 30 / 100 USD; bonus credits on larger packs.
2. **Optional monthly Pro** = lower markup (e.g. 2.0) + features (cloud sync, team workspace) + a small included credit amount; still pay-as-you-go beyond it.
3. **Meeting Bot surcharge**: vendor bot cost per meeting-hour is metered separately (`kind=bot`).
4. Auto top-up (opt-in) with monthly spending cap.

## Limits & safety
- Pre-flight check before session start: balance ≥ 5 min estimate.
- Live `usage.tick` event every 10 s to the client.
- Warn at 20% and 5% balance; hard stop at 0 after 60 s grace.
- Daily spending cap and monthly cap settable by user.

## Usage dashboard (`/usage`)
- Cards: balance (credits + estimated minutes), spent today / this month / this year.
- Chart (day / month / year toggle) of credits and minutes; breakdown by kind (STT, LLM, TTS, bot).
- Table of meetings with duration, credits, export CSV.
- Settings: caps, alerts, auto top-up, invoice email.

## Admin
Admin page: margin per user, provider cost vs revenue, top consumers, ability to adjust `MARKUP` without redeploy (DB-backed setting).
