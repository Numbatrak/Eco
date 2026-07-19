# Numbatrak Super Admin Dashboard — Build Plan

**Status:** Draft plan for review. Not yet a locked build order.
**Source of truth:** `Numbatrak_SaaS_Infrastructure_SuperAdmin.docx` (the locked
Super Admin spec, 7 tabs). Where `Numbatrak_SaaS_Infrastructure_v1.pdf` conflicts,
v1 is superseded per the doc-reconciliation memo (Part A). Cross-referenced with
`Numbatrak_Feature_Spec_WORKING.pdf` §24 (Settings / subscription lifecycle).

This plan covers the **Super Admin Dashboard** — the internal control room. It
picks up where Section 7 (Platform billing backend) left off and sequences the
remaining work: a shared metrics foundation, then the 7 tabs in dependency order.

---

## 1. Locked foundation — already built, do NOT rebuild

| Capability | Where | Notes |
|---|---|---|
| Super Admin auth (separate system, 2FA mandatory, CLI-only accounts) | `apps/api/src/lib/platform-admin-auth.ts`, `plugins/platform-admin-access.ts` | Satisfies the "completely separate authentication + 2FA" LOCKED RULE. |
| `platform_plans` (limits-based feature-set) | `packages/db/src/schema.ts` | Aligns with Part A (limits, not feature-area gating). |
| `platform_subscriptions` (trial/active/past_due/locked/cancelled) | same | Carries `billingInterval`, `currentPeriodStart/End`, `trialEndsAt`, `gracePeriodEndsAt`, `lockedAt`. |
| `platform_transactions` (single revenue source of truth) | same | `type` (subscription \| credit_purchase), `amountCents`, `vatCents`, `status`. |
| `platform_credit_ledger` (email/WhatsApp pools, SUM-on-read) | same | Mirrors `credit_adjustments`. |
| Platform Paystack webhook (distinct from tenant payments) | `modules/platform-billing/routes/webhooks.ts` | Idempotent via `platform_billing_webhook_events`. |
| Dunning engine (48h grace, no auto-cancel, 90-day) | `modules/platform-billing/lib/dunning.ts` | Matches Part A locked sequence. |
| Tenant admin actions (partial): plan change, suspend/reactivate, credit adjust, audit log | `modules/platform-admin/` | Feeds Tab 2. |

---

## 2. Cross-cutting backend gaps (Phase A — build before any tab shows real numbers)

The current `metrics-overview` endpoint is a **placeholder that measures the wrong
thing**: it sums tenant *order GMV* (`orders.totalCents`), which is the tenants'
shopper sales — explicitly NOT Numbatrak's revenue. Per the locked money model,
Numbatrak's revenue is **subscriptions + credits from `platform_transactions`**.
Six gaps block the real Super Admin metrics:

- **G1 — Signup + subscription UTM attribution.** The UTM columns that exist today
  are on `orders` (shopper attribution). The spec's LOCKED RULE requires *every
  signup* and *every subscription* to carry UTMs (source/medium/campaign/content/
  term) captured at registration — the join key for acquisition channels and
  affiliate commission. → add UTM columns to `organization` (or a `signup_attribution`
  table), capture at registration, copy onto `platform_subscriptions` on conversion.
- **G2 — Activity tracking (DAU/MAU, unique active today, last login).** No activity
  store exists (only Better Auth `session`). → lightweight `user_activity_events` or a
  daily `active_user_days` rollup keyed by (userId, date).
- **G3 — Platform revenue metrics engine.** Rewrite `metrics.ts` to compute MRR/ARR/
  active-by-tier/trial/churn/conversion from `platform_subscriptions` +
  `platform_transactions`. Retire the order-GMV metric from the Super Admin Overview
  (it belongs to tenant-facing dashboards, not here).
- **G4 — Credit purchase initiation flow.** The ledger + transaction recording exist,
  but the tenant-facing "buy credits via the platform's Paystack" flow is not built,
  and the webhook only handles subscription `charge.success`. Revenue-split Zone 2
  needs real `credit_purchase` transactions flowing in. → credit checkout init +
  webhook branch that writes a `credit_purchase` transaction and a positive ledger entry.
- **G5 — Health thresholds + founder alerts.** No alerting exists. The Overview's
  green/amber/red states and the "critical fires a founder alert" rule need a
  threshold evaluator + a notification sink (bell now; email/WhatsApp later, matching
  the Feature Spec's Q3 note).
- **G6 — Trend time-bucketing + point-in-time state.** Churn ("active at *start* of
  period") and NRR ("MRR *start* vs *end*, existing cohort") need historical state.
  **Recommendation:** a daily `platform_metric_snapshots` rollup (MRR, active count,
  by-tier, credit balance) rather than reconstructing point-in-time state on every
  query — makes churn/NRR/trend lines cheap and correct, and is the natural backing
  store for the 4/8/12-week toggles.

---

## 3. Phased build order (7 tabs, dependency-sequenced)

```
Phase A  Metrics foundation (G1–G6)                     ← unblocks everything
Phase B  Tab 1  Overview          (the queued "Section 8")
Phase C  Tab 2  Tenants           (drill-in + admin actions)
Phase D  Tab 3  Revenue           (ledger, dunning view, tax/VAT, refunds)
Phase E  Tab 4  Credits           (pricing, consumption, margin)   ⚠ needs pricing decision
Phase F  Tab 5  Affiliates        (commission 10% is locked)
Phase G  Tab 6  Operations        (announcements, usage, churn, health, audit, errors)
Phase H  Tab 7  Business Numbers   (P&L, expenses, ad performance)
```

**Dependency loop to call out:** Tab 1's *unit-economics zone* (CAC, payback) depends
on **ad-spend/marketing-expense data that lives in Tab 7**. So Overview ships in two
waves:
- **B1 (now):** everything computable from billing data — MRR, ARR, active subs by
  tier, trial accounts, churn, trial-to-paid, revenue split, LTV, NRR, DAU/MAU,
  failed-payments/dunning stage.
- **B2 (after Phase H):** CAC, LTV:CAC, payback period — backfilled once expense data
  exists. Until then, show these as "awaiting expense data," not zero.

---

## 4. Tab 1 (Overview) — detailed spec for the immediate build

Three stacked zones, time-filterable (today / this week / month / last month /
quarter / year / all time / custom), each with a 4/8/12-week trend toggle.

### Zone 1 — Headline metrics
| Metric | Formula (from locked rules) | Data source | Ready in |
|---|---|---|---|
| MRR | Σ active monthly sub revenue; **annual ÷ 12**; trial = 0; suspended = 0; cancelled counts until cycle end | `platform_subscriptions` + `platform_plans` | B1 |
| ARR | MRR × 12 | derived | B1 |
| Active subscriptions | count paying, **broken down by tier** | `platform_subscriptions.status='active'` grouped by `planId` | B1 |
| Trial accounts | count in trial + days remaining + expiry | `status='trial'`, `trialEndsAt` | B1 |
| Churn rate | cancelled this period ÷ active at start (%) — <5% healthy, >8% critical | snapshots (G6) | B1 |
| Trial-to-paid | paid conversions ÷ trial starts — <10% critical, >30% excellent | subscriptions + snapshots | B1 |
| New signups today | real-time count **+ UTM source** | `organization` + G1 | B1 (needs G1) |
| DAU/MAU | daily active ÷ monthly active | G2 | B1 (needs G2) |
| Unique active today | logged-in-and-used count | G2 | B1 (needs G2) |
| Failed payments | outstanding failed charges this cycle **+ dunning stage** | `platform_subscriptions.status IN (past_due,locked)` + `platform_transactions` | B1 |

### Zone 2 — Revenue split (always two streams, never merged)
- **(1) Subscription revenue** by tier, monthly + annual breakdown.
- **(2) Credit sales revenue** (email + WhatsApp).
- Each stream: **gross collected · VAT portion · net after VAT**; combined total on top.
- **VAT = 7.5% on subscriptions only**; credit purchases are not VAT-liable.
- Source: `platform_transactions` (`vatCents` already modeled). Credit stream needs G4.

### Zone 3 — Unit economics
| Metric | Formula | Ready in |
|---|---|---|
| CAC | (marketing + ad spend) ÷ new paying customers | **B2** (needs Tab 7) |
| LTV | avg monthly revenue/user × avg months retained | B1 |
| LTV:CAC | LTV ÷ CAC — <3:1 unsustainable, >5:1 excellent | B2 |
| Payback period | CAC ÷ monthly revenue/user | B2 |
| Net revenue retention | MRR end ÷ MRR start, existing cohort only, excl. new signups — >100% healthy | B1 (needs snapshots G6) |

### Health states (drives colour + alerts)
- **Empty:** no tenants/revenue → all zeros, clean copy ("Numbatrak is live. Waiting for the first signup."), not an error.
- **Healthy (green):** churn <5%, trial-to-paid >25%, LTV:CAC >5:1, no integration errors.
- **Warning (amber):** churn 5–8%, trial-to-paid 15–25%, LTV:CAC 2:1–5:1, or dunning queue building.
- **Critical (red):** churn >8%, trial-to-paid <15%, LTV:CAC <2:1, Paystack erroring, or unresolved failed payments → **fires founder alert (G5).**

### Endpoints (extends `platform-billing` / `platform-admin`, all `requirePlatformAdminAuth`)
```
GET /platform-admin/overview?from=&to=&trend=4|8|12   → { zone1, zone2, zone3, health }
GET /platform-admin/overview/trends?metric=mrr|churn|conversion|revenue&weeks=4|8|12
```

---

## 5. Open founder decisions — blocking, do NOT invent

These are genuinely undecided in the source docs (v1.pdf lists them as "decision
needed"). They gate specific phases:

1. **Plan pricing (naira, monthly + annual).** ⚠ Migration `0009_platform_billing.sql`
   seeded **placeholder** prices (Starter ₦9,999 / Growth ₦29,999 / Pro ₦49,999 mo).
   These are guesses — the founder must set real numbers before launch. Blocks accurate MRR.
2. **Trial length + mechanics.** v1 floats 14 days with a day-10 prompt; card-upfront
   vs no-card is open. Blocks trial-account expiry display and trial-to-paid cohorting.
3. **Free permanent plan?** Open in v1 — distinct from a trial. Affects plan matrix.
4. **Credit pricing + bundles + provider costs.** Needed for Tab 4 (Credits) margin
   view and the P&L credit-income-as-margin line. Blocks Phase E.

*(Locked, not open: affiliate commission = 10% recurring, settable per affiliate;
VAT = 7.5% subscriptions only; 48h grace; no auto-cancel; 90-day retention.)*

---

## 6. Doc-hygiene action items carried from Part A (still pending)

- **Feature Spec §24** still states the **24-hour** grace in multiple LOCKED RULEs
  (confirmed on read). Annotate → `48h (superseded from 24h — see SuperAdmin.docx
  Tab: Operations)`.
- **v1.pdf**: mark the **day-15 auto-cancel** step and the **tier-based feature-gating
  matrix** as superseded when v1 is reconciled wholesale.
- One nuance to log: the Feature Spec locks **"API keys — Pro plan only"** and
  **"team slots gate by plan."** These are legitimate *enhancement/limit* gates
  (consistent with Part A's "enhancements within a feature are fine"), not the
  whole-module blocking Part A overrode. `platform_plans.limits` already models seat
  counts; API-key access is the one true on/off that plan tier legitimately gates.

---

## 7. Suggested next step

Build **Phase A (metrics foundation)** and **Phase B1 (Overview, billing-data
metrics)** together — they're the smallest shippable slice that makes the Super Admin
landing page show real, correct numbers. Defer B2 (CAC/payback) until Phase H.

Before starting, get the founder's call on **decision #1 (pricing)** — everything MRR
touches is wrong until the seeded placeholders are replaced.
