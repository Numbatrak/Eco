# Phase Next — Feature Backlog

**Source:** `outline/Numbatrak_Feature_Spec_WORKING - New.pdf`
**Purpose:** Everything in the spec that **does not exist yet**, is a **route stub/placeholder**, or lives in a **separate HR/CRM/Storefront subsystem** — to be built after Phase Current stabilization (`PHASE-CURRENT-STABILIZATION.md`).

**Last verified against code:** 2026-08-22. Items shipped since the previous alignment (2026-07-21, commits `dada4fa`, `244ae79`) have been moved to the [Shipped since last alignment](#shipped-since-last-alignment) appendix — keep this doc limited to what's actually still missing.

**Explicitly excluded from Phase Current:** items marked here as Phase Next, plus cross-cutting layers still "to walk" in the spec (Notifications, Messaging & Integrations — documented below as foundations).

---

## Summary matrix

| Spec # | Feature | Codebase today | Phase |
|--------|---------|----------------|-------|
| 23 | Storefront | ⚠️ Embed forms only | Next |
| 24 | Settings (subscription/billing) | 🔲 `services/subscription.ts` exists, unwired to any route | Next |
| — | Messaging & Integrations | 🔲 Placeholder `/integrations` | Next (foundation) |
| — | Notifications | ⚠️ Partial in-app only | Next (foundation) |
| — | Funnel Analytics | 🔲 Placeholder `/funnel-analytics` | Next |
| — | Business Analytics | 🔲 Placeholder `/business-analytics` | Next |
| — | Super Admin | ❌ Not in repo | Next / platform |

See the [appendix](#shipped-since-last-alignment) for Payroll, Accounting, Staff, Attendance, Strikes, Stars, Leave, Invoicing, Media Buyers, and CRM — all shipped.

---

## Build principles (carry forward)

1. **Settable-by-default** — thresholds, rates, windows, entitlements are per-business settings.
2. **One revenue truth** — delivered orders; Accounting, Dashboard, CRM, and Media Buyers must agree.
3. **No double-counting** — order profit vs expense hub vs refunds/chargebacks (see CRM).
4. **RLS + org scope** on every new table.
5. **Agents ≠ staff** — external delivery partners vs internal payroll.
6. **Q3 / messaging** — WhatsApp/email automations named in spec but not launch blockers for intake features.

---

## 23. Storefront

**Status in spec:** Locked — port from live ÀY Ọ̀ NÍ build (ayoni.ng)

### What it is

Multi-tenant e-commerce: each business gets themed shop + funnel pages; orders flow into same Orders/Inventory/Wallet/CRM pipeline.

### Two surfaces

| Surface | Description |
|---------|-------------|
| **Store** | Shopify-style shop: collections, product pages, cart, wishlist, checkout |
| **Funnel mode** | Per-product standalone landing page + COD form on page (wraps Order Form builder §15) |

### Checkout

- Payment setting: COD only / Prepaid only / Both (Paystack)
- Prepaid: revenue on delivery, cash skips Wallet, delivery fee at checkout
- **Discounts** (Shopify-style, distinct from product offers): amount off products, buy X get Y, amount off order, free shipping
- **Delivery config:** zone rates by location; VAT toggle
- **Attribution:** UTM + click IDs (fbclid/ttclid/gclid); sticky first-touch + last-touch on order/customer

### Current codebase

- Embeddable order forms (`public/embed.js`) — **not** full storefront
- No tenant shop routes, cart, Paystack checkout, or funnel page builder
- Note: `apps/storefront` is a separate app in this monorepo already serving a Next.js storefront for non-Numbatrak tenants — evaluate reuse before building a parallel surface here

### Dependencies

- Products variants/offers (shipped)
- Order Forms builder (reuse for funnel form)
- CRM for attribution storage (shipped — check for reuse)
- Messaging for transactional emails
- Integrations: Paystack, Meta Pixel/CAPI (optional)

### Suggested build order

1. Tenant routing + theme shell
2. Store catalog + cart + checkout (COD path first)
3. Delivery fee + payment settings
4. Funnel page builder wrapping form builder
5. Prepaid/Paystack
6. Discounts engine
7. Attribution capture → orders + CRM

---

## 24. Settings (account layer)

**Partial today:** `/profile`, `/organization-settings` (team, invitations, order assignment, theme). `src/services/subscription.ts` exists (added 2026-07-25) but has no route or page wired to it yet.

### Full spec scope (Phase Next)

| Area | Features |
|------|----------|
| Profile | Identity, logo, phone/WhatsApp, timezone, currency, delete account + export |
| Subscription | Upgrade/downgrade/cancel/reactivate; state machine; failed-payment dunning (3-day warn, 24h grace, lock, 90-day retention) |
| Billing | History, PDF invoices, payment method |
| Team | Plan-gated slots; activity log |
| Data | CSV export/import (orders, products, expenses); retention policy display; API keys (Pro) |

### Locked rules

- Fully self-serve
- Downgrade pending until conflicts resolved (team size / features in use)
- Cancel/delete → exit survey → Super Admin churn analytics
- 90-day data retention after cancel

### Dependencies

- Payment provider integration
- Super Admin for plans, credits pricing, churn analytics
- Notifications for dunning emails

---

## Cross-cutting: Messaging & Integrations

**Route stub:** `/integrations` → `PlaceholderPage` ("Phase 1 placeholder")

### Integrations (spec)

API keys plugged once: email provider, WhatsApp/SMS, Paystack, Meta Pixel, Conversion API, etc.

### Messaging engine

Transactional vs marketing; CRM campaigns consume credits; order confirmation, abandoned cart, feedback scheduling, invoice send, payroll payslip — **included in subscription** (not credit pools)

### Features waiting on this layer

| Feature | Message type |
|---------|--------------|
| Order deliver | WhatsApp delivery update (Q3) |
| Abandoned cart | Auto recovery WhatsApp |
| Follow-ups | Auto message before CRS chase |
| Invoicing | Send PDF on delivery |
| Payroll | Payslip email |
| CRM Automations | Campaign sends |
| Notifications | Email tier events |

### Suggested build order

1. Email provider (SendGrid/Brevo) — **unblocks auth/invites production**
2. Message template storage + send queue
3. WhatsApp provider + credit accounting
4. Pixel/CAPI configuration UI
5. Paystack for storefront prepaid

---

## Cross-cutting: Notifications

**Partial today:** In-app components (`FollowUpNotifications`, `InvitationNotification`, activity feed) — **no** unified bell, per-event settings, or email fan-out per spec.

### Architecture (spec)

- Event → N recipients; **independent read state** per recipient
- **Bell** native; **email** via Messaging engine
- Channel split: email+bell for money/stock/discipline/complaints; bell-only for workflow awareness
- Owner toggles each event's bell/email **business-wide** in Settings

### Email + bell tier (examples)

Payroll paid, wallet remittance/shortfall, dashboard red flags, strikes, stock low/damage/waybill, complaints escalated/refund, contractor paid, CPA over target, credits low, subscription dunning

### Bell-only tier (examples)

Star/SOTM, leave, attendance, new order, abandoned cart, follow-up due, production batch done, feedback call due

### Dependencies

- Messaging for email tier
- Each feature emits events as built

---

## Analytics pages (stubs)

| Route | Placeholder text | Spec relationship |
|-------|------------------|-------------------|
| `/funnel-analytics` | Per-funnel ad performance | Drill-down of Dashboard CPA/ROAS per funnel/offer — likely **part of Media Buyers performance side** (shipped — see appendix) or thin wrapper over `dashboardMetrics` + spend attribution |
| `/business-analytics` | Business-level ROAS vs ROI | Business-level view from Dashboard §3 toggle — may merge into Dashboard rather than separate page |

**Recommendation:** Decide whether these remain separate nav items or collapse into Dashboard views + Media Buyers to avoid three places for the same numbers.

---

## Super Admin (platform)

Referenced throughout spec but not in tenant app:

- Subscription plans + feature gates
- Credit pricing (email/WhatsApp marketing pools)
- Churn analytics from exit surveys
- Tenant provisioning

**Build as separate admin surface or Supabase-backed internal tools.** Note: `apps/admin` (platform-admin console) already exists in this monorepo — evaluate extending it before standing up a new surface.

---

## Explicitly future / not launch (spec § Future automation)

Documented so launch limitations are not treated as permanent:

| Item | Launch approach |
|------|-----------------|
| Multi-touch attribution | Last-click first-party only |
| Full accounting engine | Light P&L + Zoho |
| Creative-level platform ad-ID mapping | Buyer weekly report + server attribution |
| Agent login portal | Internal team manages agents |
| WhatsApp on every touchpoint | Q3 where marked |
| Per-user notification preferences | Business-wide toggles first |
| Expense Claims | Removed from product |

---

## Recommended Phase Next roadmap (high level)

### Wave A — Foundations
1. Messaging & Integrations (email first)
2. Notifications (bell + settings schema)

### Wave B — Growth & ops
3. CRM Automations + credits (base CRM shipped — see appendix)

### Wave C — Commerce
4. Storefront store + checkout
5. Funnel pages + attribution
6. Settings subscription/billing + Super Admin

### Wave D — Analytics consolidation
7. Decide fate of `/funnel-analytics` and `/business-analytics` stubs (merge into Dashboard/Media Buyers or build standalone)

---

## Route stub inventory (remove placeholders when built)

| Path | Component | Replace with |
|------|-----------|--------------|
| `/integrations` | `PlaceholderPage` | Integrations + messaging config |
| `/funnel-analytics` | `PlaceholderPage` | Funnel performance or redirect to Media Buyers |
| `/business-analytics` | `PlaceholderPage` | Business ROI view or Dashboard toggle |

`/invoicing` and `/accounting` are no longer in this table — both replaced with real pages (see appendix).

---

## Shipped since last alignment

Moved out of the active backlog on 2026-08-22 after confirming each has a real route + page (not `PlaceholderPage`) in `App.tsx`, plus a matching `apps/api/src/modules/numbatrak-*` backend module. Kept here (condensed) as a locked-rules reference for auditing correctness, not as build guidance.

| Spec # | Feature | Frontend | Backend | Shipped |
|--------|---------|----------|---------|---------|
| 4 | Payroll | `components/payroll/PayrollPage.tsx` → `/payroll` | `numbatrak-payroll` | `dada4fa` |
| 6 | Accounting (P&L) | `components/accounting/AccountingPage.tsx` → `/accounting` | `numbatrak-accounting` | — |
| 7 | Staff | `StaffForm` / `StaffDetailPage` → `/staff` | `numbatrak-staff` | — |
| 8 | Attendance | `components/attendance/AttendancePage.tsx` → `/attendance` | `numbatrak-attendance` | `dada4fa` |
| 9 | Strikes | `components/strikes/StrikesPage.tsx` → `/strikes` | `numbatrak-strikes` | `dada4fa` |
| 10 | Stars & Leaderboard | `components/stars/StarsPage.tsx` → `/stars` | `numbatrak-stars` | — |
| 11 | Leave | `components/leave/LeavePage.tsx` → `/leave` | `numbatrak-leave` | — |
| 11b | Order Assignment | Org settings | `numbatrak-order-assignment` | (predates this doc) |
| 20 | Invoicing | `components/invoicing/InvoicingPage.tsx` → `/invoicing` | `numbatrak-invoicing` | — |
| 21 | Media Buyers | `components/media-buyers/MediaBuyersPage.tsx` → `/media-buyers` | `numbatrak-media-buyers` | `244ae79` |
| 22 | CRM | `components/crm/CrmPage.tsx` → `/crm` | `numbatrak-crm` | `244ae79` |

### Locked rules worth re-checking against the live implementation

- **Payroll:** base salary never gated; commission delivery-rate gate zeros the *whole month*, not pro-rated; upsell never gated; manager gate defaults to 50% of team hitting KPI (settable); Numbatrak calculates, does not disburse.
- **Accounting:** pull-only, no manual entry; income = delivered orders (must match Dashboard); cash position reads Wallet; full double-entry still parked (Zoho Books for now).
- **Invoicing:** manual generation only, not automatic per order; delivery triggers customer send via messaging; must not double-count revenue.
- **Media Buyers:** spend entered once, read by both Expenses (Advertising) and Dashboard — never entered twice; ROAS = delivered revenue ÷ ad spend; no manual ad-ID mapping at launch (buyer report + server attribution only).
- **CRM:** every order creates/updates a customer regardless of delivery outcome; More Purchase is *not* an order-time upsell and must not double-count revenue; refunds reverse the sale rather than booking as an expense; campaigns blocked when the credit pool is empty.
- **Staff / Attendance / Strikes / Stars / Leave:** six-role model (CRS, Manager, Admin, Media, Accountant, Founder) with multi-role union access — confirm this reconciled with the app's actual RBAC (`Owner, Admin, Manager, Customer Relations`) rather than silently diverging.

---

## When to update this document

- Spec adds sections ("STILL TO WALK" items confirmed)
- A feature moves from Next → Shipped (move its row from the summary matrix to the appendix, condense its detail)
- Placeholder routes replaced with real pages
- Dependencies satisfied (note in both phase docs)

---

*Last aligned to feature spec working draft (59 pages) on 2026-07-21; re-verified against the live codebase on 2026-08-22. Pair with `PHASE-CURRENT-STABILIZATION.md` for execution.*
