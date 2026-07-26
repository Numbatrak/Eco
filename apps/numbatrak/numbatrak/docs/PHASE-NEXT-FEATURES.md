# Phase Next — Feature Backlog

**Source:** `outline/Numbatrak_Feature_Spec_WORKING - New.pdf`  
**Purpose:** Everything in the spec that **does not exist yet**, is a **route stub/placeholder**, or lives in a **separate HR/CRM/Storefront subsystem** — to be built after Phase Current stabilization (`PHASE-CURRENT-STABILIZATION.md`).

**Explicitly excluded from Phase Current:** items marked here as Phase Next, plus cross-cutting layers still “to walk” in the spec (Notifications, Messaging & Integrations — documented below as foundations).

---

## Summary matrix

| Spec # | Feature | Codebase today | Phase |
|--------|---------|----------------|-------|
| 4 | Payroll | ❌ Not in repo | Next |
| 6 | Accounting (P&L) | 🔲 Placeholder `/accounting` | Next (light launch version) |
| 7 | Staff | ❌ Not in repo | Next |
| 8 | Attendance | ❌ Not in repo | Next (optional module) |
| 9 | Strikes | ❌ Not in repo | Next |
| 10 | Stars & Leaderboard | ❌ Not in repo | Next |
| 11 | Leave | ❌ Not in repo | Next |
| 11b | Order Assignment | ✅ In org settings | **Current** (stabilize only) |
| 20 | Invoicing | 🔲 Placeholder `/invoicing`; orphan PDF util | Next |
| 21 | Media Buyers | ❌ Not in repo | Next |
| 22 | CRM | ❌ Not in repo | Next |
| 23 | Storefront | ⚠️ Embed forms only | Next |
| 24 | Settings (subscription/billing) | ⚠️ Profile + org only | Next |
| — | Messaging & Integrations | 🔲 Placeholder `/integrations` | Next (foundation) |
| — | Notifications | ⚠️ Partial in-app only | Next (foundation) |
| — | Funnel Analytics | 🔲 Placeholder | Next |
| — | Business Analytics | 🔲 Placeholder | Next |
| — | Super Admin | ❌ Not in repo | Next / platform |

---

## Build principles (carry forward)

1. **Settable-by-default** — thresholds, rates, windows, entitlements are per-business settings.  
2. **One revenue truth** — delivered orders; Accounting, Dashboard, CRM, and Media Buyers must agree.  
3. **No double-counting** — order profit vs expense hub vs refunds/chargebacks (see CRM).  
4. **RLS + org scope** on every new table.  
5. **Agents ≠ staff** — external delivery partners vs internal payroll.  
6. **Q3 / messaging** — WhatsApp/email automations named in spec but not launch blockers for intake features.

---

## 4. Payroll

**Status in spec:** Locked — partly built in HR system (not in this frontend repo)

### What it is

Flexible pay engine: toggleable components (base, commission, upsell, Star of the Month, manual adjustment), optional gates (delivery-rate commission gate, manager team-ratio gate), monthly payment run, overrides, mark paid (disburse outside app).

### Screens

- Pay structure per staff/role tier  
- Calculation trace (line-by-line)  
- Payment run (calculate → review → override → mark paid)  
- **Live earnings view** for performance staff (real-time through month + gate status)

### Locked rules (implementation constraints)

- Base salary never gated  
- Commission: flat per delivered order OR % of sale; optional delivery-rate gate zeros **whole month** commission if missed  
- Upsell never gated  
- Manager gate: default 50% of team must hit KPI (settable)  
- Numbatrak calculates, does not disburse  
- Overrides stick through re-run with warning; reversible  
- All figures from live Orders data (delivered, upsells, delivery rate)

### Dependencies

- Staff records (§7)  
- Orders with upsell attribution + delivered status (Phase Current)  
- Stars & SOTM (§10) for SOTM component  
- Notifications for payslip (§ Notifications)

### Suggested build order

1. DB: pay structures, components, gates, payroll runs, line overrides  
2. Calculation engine from order facts  
3. Admin payment run UI  
4. Staff live earnings view (role-scoped)  
5. Mark paid + notification + payslip email  

---

## 6. Accounting

**Route stub:** `/accounting` → `PlaceholderPage`  
**Status in spec:** Locked — **lighter version for launch** (full double-entry parked)

### What it is

Consolidated P&L + cash view across sub-brands — not Zoho replacement at launch.

### Screens

- Consolidated P&L (income, expenses by category, net profit, expense % of revenue)  
- Per sub-brand drill-down  
- **Cash position** (earned vs collected; outstanding COD from Wallet)

### Actions

Toggle consolidated vs sub-brand; filter by time/sub-brand/category; export P&L (CSV/PDF for accountant)

### Locked rules

- Pull only — no manual income/expense entry here  
- Income = delivered orders; same number as Dashboard  
- Cash position reads Wallet (prepaid + company-paid + remitted COD vs outstanding)  
- Four expense categories match Expenses hub

### Parked for later (spec §6)

Chart of accounts, journals, vouchers, suppliers, balance sheet, cash flow, bank reconciliation, AP/AR, break-even, tax provision — **Zoho Books for now**

### Dependencies

- Phase Current: Orders, Expenses, Wallet cash gap  
- Sub-brand dimension on org

### Suggested build order

1. Replace placeholder route with P&L service aggregating existing tables  
2. Cash position panel wired to Wallet  
3. Sub-brand toggle + export  

---

## 7–11. Staff Management suite

**Status in spec:** Locked — exists in legacy HR system; must become **settable** in Numbatrak

| # | Feature | Module | Notes |
|---|---------|--------|-------|
| 7 | Staff | Core roster | Primary + extra roles; multi sub-brand; bank details → Payroll |
| 8 | Attendance | Optional | Self-mark; auto-close window; exemptions; off per business |
| 9 | Strikes | Discipline | Non-monetary; settable threshold → consequence; bulk issue |
| 10 | Stars & Leaderboard | Recognition | Configurable tiers; manual award; SOTM → Payroll |
| 11 | Leave | HR | 4 types; settable entitlements; approval workflow |

### Six-role model (spec)

CRS, Manager, Admin, **Media**, **Accountant**, **Founder** — with **multi-role union** access pattern.

**Current app roles:** Owner, Admin, Manager, Customer Relations — map and extend RBAC + `permissions.ts` when building Staff.

### 7. Staff — detail

- Staff list filtered by brand/role  
- Record: personal details, roles, bank, pay structure link  
- Actions: create/edit, filter  
- Rules: union of role permissions; multi-brand coverage

### 8. Attendance — detail

- Optional module (hidden when disabled)  
- Events, self-mark, exempt, history  
- Auto-close assigns late/absent; exempt skipped for strikes

### 9. Strikes — detail

- Issue/clear with reason; bulk issue  
- Threshold → consequence (e.g. 2/month → HR review) — settable  
- Notifications on issue

### 10. Stars & Leaderboard — detail

- Configurable star tiers (not a running tally)  
- Manual award by heads  
- Leaderboard style settable (revenue, delivery rate, stars, etc.)  
- SOTM: optional; criteria menu; prize → Payroll SOTM component

### 11. Leave — detail

- Types: annual, sick, emergency, unpaid  
- Request → approve/decline; balance tracking  
- Approved leave not marked absent by Attendance

### Dependencies

- Notifications layer  
- Payroll (§4) for pay structure link and SOTM  
- Settings for module toggles

### Suggested build order

1. Staff + role model extension  
2. Leave (simplest workflow)  
3. Attendance (optional flag)  
4. Strikes  
5. Stars & Leaderboard + SOTM config  
6. Payroll integration  

---

## 20. Invoicing

**Route stub:** `/invoicing` → `PlaceholderPage`  
**Orphan code:** `src/utils/generateInvoice.ts` (only referenced from unwired legacy `OrderTableRow`)

### What it is

Generate/send invoices on request — **not** auto on every order; auto-send to customer **on delivery** via messaging.

### Screens

Invoice view (generate, download PDF, send); invoice list with filters

### Actions

Manual generate; generate from order shortcut; download PDF; send via messaging

### Locked rules

- Manual generation; delivery triggers customer send  
- Does not double-count revenue (order already counts when delivered)

### Dependencies

- Messaging layer (send)  
- Orders mark-delivered hook  
- PDF template (extend existing util)

---

## 21. Media Buyers

**Status in spec:** Locked — central for ad-running businesses; empty for non-ad businesses

### What it is

Full advertising subsystem: creative production, contractor payments, ad catalog, spend logging, performance analytics — **source of ad spend** for CPA/ROAS everywhere.

### Attribution spine

**Brand → Product → Offer → Platform** (finest grain business advertises to)

### Side one — Creative production

- **Production log** — batches (buyer, brand, product, creative type, VO, editor, video count, status)  
- Mark batch **Done** → flows videos to ad catalog + updates contractor piece counts  
- **Team & payments** — VO/editors, piece rates, mark paid → Expenses (Marketing)  
- **Ad catalog** — ad as **object** (one video = one ad), Google Drive link per batch, lineage metadata

### Side two — Performance

- **Log spend** daily per Brand/Product/Offer/Platform  
- CPA auto-calculates; targets per buyer/brand/product/offer  
- Optional **weekly narrative review** (toggle off for solo sellers)  
- Dashboard CPA flags driven by targets here

### Locked rules

- Spend entered once → read by Expenses (Advertising) + Dashboard/Performance  
- ROAS = delivered revenue ÷ ad spend; Real CPA = ad spend ÷ delivered  
- Two attribution paths: buyer weekly report (human) vs server-side measured (CRM/storefront) — no manual ad-ID mapping at launch  
- Legacy spreadsheet import **dropped**

### Dependencies

- Products with offers (Phase Current/Product model)  
- Expenses advertising category + mandatory attribution  
- Dashboard metrics  
- Optional: CRM for measured attribution view

### Suggested build order

1. Spend entry + attribution keys → Expenses feed  
2. Production log + catalog (Drive links)  
3. Contractor payments → Marketing expenses  
4. Performance drill-down (feeds Funnel Analytics page)  
5. CPA targets + dashboard alert integration  
6. Optional weekly review narrative  

---

## 22. Customer Management (CRM)

**Status in spec:** Locked — full subsystem (5 parts)

### Parts

1. **Customer Database** — dedupe on phone; LTV; income sources (orders vs more-purchase); products bought; first/last click source; full history (delivered/failed/refunded)  
2. **Feedback Calls** — auto-schedule after delivery (default ~3 days, settable); queue + dispositions; analytics dashboard (reach, satisfaction, more-purchase revenue, per-officer)  
3. **Complaints** — list + patterns dashboard; attachments; escalation to founder; chargebacks cost  
4. **Automations** — segment + email/WhatsApp campaigns; **credit pools** (marketing only; transactional included in subscription)  
5. **More Purchase** — sale on feedback call; **not** an Order — full economics (inventory, COGS, delivery, Wallet COD) but attaches to customer LTV

### Locked rules (high risk)

- Every order creates/updates customer (delivered or not)  
- More Purchase ≠ order-time upsell  
- Refund: reverse sale on order — **do not** book full refund as expense; Chargebacks expense for sunk delivery + product if not returned  
- Replacement: inventory + cost + redelivery fee, no new revenue → Chargebacks  
- Campaigns blocked when credit pool empty

### Dependencies

- Orders + money flag + delivery (Phase Current)  
- Storefront attribution (first/last click)  
- Messaging & Integrations  
- Inventory + Wallet for More Purchase fulfilment  
- Media Buyers for source comparison (optional)

### Suggested build order

1. Customer database auto-populate from orders  
2. Feedback queue + dispositions + scheduling  
3. Complaints + chargebacks expense wiring  
4. More Purchase entity + economics  
5. Feedback analytics dashboard  
6. Automations + credits (needs platform Super Admin pricing)

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

### Dependencies

- Products variants/offers (Phase Current+)  
- Order Forms builder (reuse for funnel form)  
- CRM for attribution storage  
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

**Partial today:** `/profile`, `/organization-settings` (team, invitations, order assignment, theme)

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

**Route stub:** `/integrations` → `PlaceholderPage` (“Phase 1 placeholder”)

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
- Owner toggles each event’s bell/email **business-wide** in Settings

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
| `/funnel-analytics` | Per-funnel ad performance | Drill-down of Dashboard CPA/ROAS per funnel/offer — likely **part of Media Buyers performance side** or thin wrapper over `dashboardMetrics` + spend attribution |
| `/business-analytics` | Business-level ROAS vs ROI | Business-level view from Dashboard §3 toggle — may merge into Dashboard rather than separate page |

**Recommendation:** Decide whether these remain separate nav items or collapse into Dashboard views + Media Buyers to avoid three places for the same numbers.

---

## Super Admin (platform)

Referenced throughout spec but not in tenant app:

- Subscription plans + feature gates  
- Credit pricing (email/WhatsApp marketing pools)  
- Churn analytics from exit surveys  
- Tenant provisioning  

**Build as separate admin surface or Supabase-backed internal tools.**

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
3. Staff + extended RBAC  

### Wave B — Money expansion
4. Accounting light P&L  
5. Payroll engine  
6. Invoicing  

### Wave C — Growth & ops
7. Media Buyers (spend → metrics)  
8. CRM (database → feedback → complaints)  
9. CRM Automations + credits  

### Wave D — Commerce
10. Storefront store + checkout  
11. Funnel pages + attribution  
12. Settings subscription/billing + Super Admin  

### Wave E — HR polish
13. Attendance, Strikes, Stars, Leave  
14. Live earnings + SOTM full loop  

---

## Route stub inventory (remove placeholders when built)

| Path | Component | Replace with |
|------|-----------|--------------|
| `/integrations` | `PlaceholderPage` | Integrations + messaging config |
| `/invoicing` | `PlaceholderPage` | Invoicing module |
| `/accounting` | `PlaceholderPage` | Accounting P&L |
| `/funnel-analytics` | `PlaceholderPage` | Funnel performance or redirect to Media Buyers |
| `/business-analytics` | `PlaceholderPage` | Business ROI view or Dashboard toggle |

---

## When to update this document

- Spec adds sections (“STILL TO WALK” items confirmed)  
- A feature moves from Next → Current after shipping  
- Placeholder routes replaced with real pages  
- Dependencies satisfied (note in both phase docs)

---

*Last aligned to feature spec working draft (59 pages). Pair with `PHASE-CURRENT-STABILIZATION.md` for execution.*
