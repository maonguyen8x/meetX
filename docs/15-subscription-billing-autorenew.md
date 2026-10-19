# 15 — Subscriptions, Payments, Quotas, Auto-Renew (supersedes docs/08 for plans; docs/08 still defines credit metering)

## Model: Plan + Quota + Wallet
- A **plan** gives a fixed fee per billing cycle and included quotas: interpretation minutes, AI tokens, storage bytes, documents, members.
- Usage beyond quota is paid from the **wallet** (prepaid credits, pay-as-you-go formula in docs/08). If wallet is empty, the metric is blocked (soft message + upgrade/top-up CTA).
- Billing cycle chosen by the user: `DAY`, `WEEK`, `MONTH`, `YEAR`, or **custom** (`interval` + `interval_count`, e.g. every 2 weeks or 3 months). Price = plan price × cycle factor from `plans` (each plan lists the allowed intervals; multi-month/year discounts configurable).
- Payments are handled through a `PaymentProvider` interface (`providers/payment`): default `stripe` (Checkout + Billing subscriptions + Customer Portal). Adding a local provider (VNPay/MoMo/etc.) later = new adapter only.

## Subscription state machine
`TRIALING → ACTIVE → (PAST_DUE → ACTIVE | EXPIRED) | PAUSED | CANCELED`
- `ACTIVE`: service on. `PAST_DUE`: payment failed, within grace period, service on with warning banner. `EXPIRED`: blocked, data retained 30 days. `PAUSED`: usage blocked, data kept, no charge. `CANCELED`: ends at period end if `cancel_at_period_end`.

## Auto-renew behaviors
| `auto_renew` | At period end |
|---|---|
| **true** | Charge the default payment method automatically (provider subscription) → new invoice PAID → extend period → reset period quotas → notify "Payment succeeded". |
| **false** | Apply the user's chosen `on_expiry_action`: `NOTIFY_ONLY` (remind; service stops after grace unless user renews manually), `SWITCH_TO_FREE` (downgrade to Free plan), `PAUSE` (freeze, keep data), `CANCEL` (end subscription). User can always press **Renew now** or **Pay now**. |
UI: a toggle "Auto-renew" and, when off, a radio group with the four actions above. Changes take effect immediately and write `subscription_events`.

## Failed payment (dunning)
Retry at +1 day, +3 days, +5 days (configurable in `system_settings`); status `PAST_DUE`; grace period 7 days (for DAY plans 12 h, WEEK plans 2 days). After grace → apply `on_expiry_action` (default `PAUSE`/`EXPIRED`). Notify at each failure with a "Update payment method" link.

## Notifications (in-app + email, respect `notification_preferences`)
- **Renewal reminders** (scaled by cycle): YEAR: 30/7/1 days before; MONTH: 7/3/1 days; WEEK: 2 days/1 day; DAY: 6 h/1 h.
- **Quota thresholds**: 80%, 90%, 100% per metric (once per threshold per period, tracked in `quota_counters.last_threshold_notified`).
- Payment succeeded / failed, subscription expired, plan changed, invoice available.
- Enterprise: ORG_ADMINs receive org-level notifications; a member hitting a personal cap notifies member + ORG_ADMIN.

## Background jobs (BullMQ, repeatable, idempotent) — `apps/api/src/jobs`
| Job | Schedule | Purpose |
|---|---|---|
| `subscription-renewal-scan` | every 5 min | find subscriptions with `current_period_end <= now()` and act per auto_renew/on_expiry_action |
| `renewal-reminder-scan` | every 15 min | send reminders by cycle offsets (dedupe via `last_reminder_sent_at` + notification key) |
| `dunning-retry` | every 15 min | retry failed payments per schedule |
| `quota-threshold-check` | on usage event + every 10 min | notify at 80/90/100 |
| `period-reset` | on renewal | create new `quota_counters` rows |
| `invoice-reconcile` | hourly | compare provider state vs local |
Webhooks from the provider are the source of truth for payment results; always verify signature and dedupe through `webhook_events`.

## Prorations & changes
Upgrade: immediate, prorated charge. Downgrade: at period end. Changing cycle (e.g. month → year): takes effect next renewal unless user chooses "switch now" (prorated). Storage over new plan limit after downgrade → read-only, never delete data automatically.

## Billing UI (`/billing`) — must be clear and easy to pay
1. **Current plan card**: plan name, cycle, price, renewal date, countdown, status badge, **Renew now / Pay now** primary button, Change plan.
2. **Quota meters** (ring or bar): minutes, tokens, storage (used / total, e.g. `3.2 GB / 10 GB`), documents, members; color warns at 80/90/100%.
3. **Auto-renew panel** (toggle + expiry action radios, with plain-language explanation).
4. **Usage & cost chart** with toggle Day | Week | Month | Year | Custom range; breakdown by kind and by member (enterprise).
5. **Payment methods** (add/remove/default) and **Top-up wallet** quick buttons (10/30/100 + custom).
6. **Invoices table**: number, period, amount, status, download PDF, Pay button on OPEN invoices; CSV export.
7. Enterprise extras: company info (tax code, address), billing contacts, per-member quota table.
Admin side: see docs/18.

## Acceptance tests (Vitest + provider fake)
Auto-renew ON charges and extends; OFF + each `on_expiry_action` behaves correctly; dunning schedule; reminder dedupe; quota thresholds fire once; wallet never negative under concurrency; webhook replay is a no-op; downgrade does not delete data.
