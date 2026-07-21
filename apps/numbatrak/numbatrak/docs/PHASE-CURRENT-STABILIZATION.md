# Phase Current — Stabilization Guide

**Source:** `outline/Numbatrak_Feature_Spec_WORKING - New.pdf`  
**Purpose:** Document everything that **already exists** in the app, and the **updates required** to match the locked spec so the current version works correctly end-to-end.  
**Out of scope here:** Payroll, HR suite, CRM, Storefront, Media Buyers, full Accounting/Invoicing, subscription billing — see `PHASE-NEXT-FEATURES.md`.

---

## How to use this document

Each section follows the same shape:

| Block | Meaning |
|-------|---------|
| **Route / entry** | Where it lives in the app today |
| **Built today** | What actually works |
| **Spec target** | What the working draft requires |
| **Gap checklist** | Concrete stabilization tasks (ordered roughly by dependency) |
| **Key files** | Where to implement |

**Status labels:** ✅ built · ⚠️ partial · ❌ missing (within this phase)

**Delivered orders:** Spec says *Delivered*; codebase uses `status = 'completed'` on `customer_orders` / `form_responses`. Treat these as the same everywhere.

**Settable-by-default:** Any threshold, window, rate, or default in the spec is a **per-org setting**, not a hard-coded constant, unless the spec says it cannot be set.

---

## Cross-cutting stabilization (do first)

These affect multiple features and should be resolved before polishing individual pages.

| # | Item | Status | Implementation |
|---|------|--------|----------------|
| C1 | **Single revenue truth** | ✅ Done (code) | `orderDataSource.ts` merges `customer_orders` + unmigrated `form_responses`; `dashboard.ts` profit/count use unified source |
| C2 | **Org scoping** | ✅ Pattern documented | All new queries use `organization_id` + `emptyWithoutOrg`; RLS unchanged |
| C3 | **Role model** | ✅ Mapped | `docs/ROLE-MAPPING.md`, `src/utils/specRoles.ts` |
| C4 | **Sub-brand** | ✅ Schema + stamps | Migration `20260720120000_*`; `forms.sub_brand`; copied on order insert via trigger |
| C5 | **Funnel / offer tag** | ✅ Schema + stamps | `offer_name` (existing), `funnel_name` on orders; form trigger; shown in order dialog |
| C6 | **Money received flag** | ✅ Done | `money_received_by` column; order dialog; Wallet filters `agent_collected` only; wallet trigger updated |
| C7 | **Legacy dead code** | ✅ Marked | `src/legacy/README.md` + `@deprecated` on orphan components |
| C8 | **Dual inventory model** | ✅ UX default | Ledger tab default; deprecation banner on legacy totals tab |

**Apply migration:** run `supabase/migrations/20260720120000_cross_cutting_order_fields.sql` on your Supabase project before testing Wallet / order edits.

<details>
<summary>Original gap table (reference)</summary>

| # | Item | Today | Spec | Action |
|---|------|-------|------|--------|
| C1 | **Single revenue truth** | Metrics split across `form_responses`, `customer_orders`, legacy `orders` | One pipeline; profit uses **delivered** orders only | Finish `orderIntake` / `orderDataSource` migration; audit mixed data (`docs/ORDER-DATA-FLUSH-STRATEGY.md`) |
| C2 | **Org scoping** | Generally enforced | Every query scoped to current org + RLS | Verify any new queries/migrations follow existing `orgQuery` / RLS patterns |
| C3 | **Role model** | Owner, Admin, Manager, Customer Relations | Six roles: CRS, Manager, Admin, Media, Accountant, Founder (+ multi-role union) | Map spec scopes to current RBAC; document interim mapping until HR roles land |
| C4 | **Sub-brand** | Limited / implicit via forms | Filters and roll-ups by sub-brand across dashboard, orders, expenses | Confirm data model for sub-brand; add field + filters where spec requires |
| C5 | **Funnel / offer tag** | Form-linked; partial attribution | Every order carries funnel/offer for performance isolation | Ensure order creation (form, manual, abandoned recovery) stamps offer/funnel consistently |
| C6 | **“Who received the money” flag** | Wallet tracks payment method partially | `agent collected` / `company account` / `prepaid` — routes order into Wallet or not | Add field on orders; wire Wallet remittance creation on mark-delivered |
| C7 | **Legacy dead code** | Orphan `OrderTable`, `ExpensesForm`, `GeneralExpensesForm`, `generateInvoice` | Single canonical UI per feature | Remove or clearly mark deprecated; avoid dual implementations confusing stabilization |
| C8 | **Dual inventory model** | Ledger (`stock_movements`) + legacy totals table coexist | One stock truth: per-agent holdings from movements | Prefer ledger path; plan deprecation of manual totals tab or merge UX |

</details>

---

## 1. Orders

**Route:** `/orders` → `OrdersForm`  
**Key files:** `src/components/OrdersForm.tsx`, `src/components/formResponses/*`, `src/services/orderIntake.ts`, `src/services/orderDataSource.ts`, `src/types/customerOrder.ts`

### Built today ✅⚠️

- Order list from greenfield `customer_orders` (fallback `form_responses`)
- View/edit dialog: status, notes, delivery fee, amount paid, agent
- Mark delivered → set status **`completed`**, set `completed_at` on v2
- Filters: form (product), CSR, search, sort
- Profit footer for completed orders
- Delete (permission-gated)
- Public intake via embed + edge functions creates orders

### Spec target

- **Screens:** Month-sectioned list (newest month on top, e.g. `JULY 2026` header); order detail; **manual entry** for DM/phone/walk-in
- **Status pipeline:** `new` → `confirmed` → `packed` → `dispatched` → `delivered`, with terminal branches `failed`, `returned`, `lost`
- **Actions:** New order, open/edit, mark delivered (auto delivery date, inventory drop), **add upsell**, **mark failed delivery** (+ expense in one action), add note (auto-dated), edit even on delivered, advance status, rich filters
- **Rules:** Inventory drops on **delivered** only; profit before ads = sales − COGS − delivery fee; role-scoped lists; funnel/offer tag; money-received flag; delivered → CRM customer record (Phase Next — but field must be ready)

### Gap checklist

| Priority | Task | Status | Notes |
|----------|------|--------|-------|
| P0 | Replace flat list with **month sections** | ✅ Done | `groupOrdersByMonth`, `FormResponseTable` `groupByMonth` |
| P0 | Implement **full status enum** + advance-status UX | ✅ Done | `orderStatus.ts`; migration `20260720130000_*`; legacy aliases |
| P0 | **Mark delivered:** auto-fill delivery date | ✅ Done | `completed_at` on transition + DB triggers |
| P0 | **Mark delivered → inventory drop** | ✅ Done | `orderDelivery.ts` → `deliver_to_customer` movements |
| P0 | Add **“who received the money”** on create/edit/deliver | ✅ Done | Cross-cutting (C6) |
| P1 | **Manual order entry** form | ✅ Done | `ManualOrderDialog` + `createManualCustomerOrder` |
| P1 | **Mark failed delivery** from order | ✅ Done | Quick action + `failed_delivery` expense |
| P1 | **Upsell on active order** | ✅ Done | Dialog upsell + `addOrderUpsellLine` |
| P1 | **Notes with auto date stamp** | ✅ Done | `orderNotes.ts` |
| P1 | Allow **edit on delivered** orders | ✅ Done | Dialog remains editable |
| P1 | Filters: agent, funnel, sub-brand, date range, status | ✅ Done | Table filter bar + v2 server filters |
| P2 | Show funnel, location, agent, status, price on row | ✅ Done | Funnel column + existing columns |
| P2 | Empty/loading/save-failed states | ⚠️ Partial | Loading/empty OK; preserve input on validation — follow-up |
| P3 | WhatsApp on deliver | ❌ Stub | Phase Next hook only |

**Apply migration:** `supabase/migrations/20260720130000_order_status_pipeline.sql` (after cross-cutting migration).

### Dependencies

- Inventory ledger (§2), Wallet (§5), Expenses failed-delivery feed (§8), Dashboard delivery rate (§3)

---

## 2. Inventory

**Route:** `/inventory`, `/agents/:agentId`  
**Key files:** `src/components/InventoryForm.tsx`, `src/components/inventory/*`, `src/services/agentStock.ts`, `src/services/stockMovements.ts`, `src/types/stockMovement.ts`

### Built today ✅⚠️

- **Stock ledger tab:** `AgentStockMatrix` + `StockMovementsLog` from `stock_movements`
- **Legacy tab:** manual per-agent/product quantity CRUD
- Transfers via `TransferDialog` → `transferInventory()`
- Receive stock at org level via Products → `ReceiveStockDialog`
- Movement types: `waybill_to_agent`, `deliver_to_customer`, `return_to_lagos`, `transfer`, `adjust`
- Agent detail page: filtered ledger + movements

### Spec target

- **Stock grid:** products × agents (including **warehouse as agent**), cost-of-inventory footer
- **Actions:** transfer (reason required), **mark damaged**, **mark missing**, filters, **low-stock threshold**, movement history
- **Rules:** delivery deducts from delivering agent; waybill-in adds stock; damaged/missing separate; no negative stock; movements dated + attributed; damage does **not** auto-post to expenses

### Gap checklist

| Priority | Task | Status | Notes |
|----------|------|--------|-------|
| P0 | **Warehouse as agent** | ✅ Done | `is_warehouse` / `can_deliver`; auto-seed per org; excluded from delivery assignment |
| P0 | Wire **order delivered → deliver_to_customer** | ✅ Done | Orders §1 `orderDelivery.ts` + non-negative check |
| P0 | Wire **waybill → waybill_to_agent** | ✅ Done | `WaybillBatchDialog` → `bulkWaybillToAgent` (external HQ supply, `from_agent_id` null) |
| P1 | **Mark damaged / mark missing** UI | ✅ Done | `AdjustStockDialog` + `damaged`/`missing` movement types |
| P1 | Enforce **non-negative stock** | ✅ Done | `getAgentProductOnHand` before transfer/delivery/shrinkage |
| P1 | **Cost of inventory footer** | ✅ Done | `StockGrid` footer Σ(qty × cost_price) |
| P2 | **Low-stock threshold** | ✅ Done (schema + UI) | `products.low_stock_threshold`; red cells in grid; set threshold on product edit — follow-up |
| P2 | Filters: product, agent, movement type, date | ✅ Done | `InventoryFilters` on `/inventory` |
| P2 | Consolidate **dual tab UX** | ✅ Done | Stock grid default; legacy tab deprecated; ledger actions on main header |
| P3 | Shrinkage reporting | ⚠️ Partial | Movements log shows damaged/missing; dedicated report Phase Next |

**Apply migration:** `supabase/migrations/20260720140000_inventory_stabilization.sql`

---

## 3. Dashboard

**Route:** `/` → `DashboardPage`  
**Key files:** `src/components/dashboard/DashboardPage.tsx`, `DashboardSummary.tsx`, `src/services/dashboardMetrics.ts`, `src/services/dashboard.ts`

### Built today ✅⚠️

- **Filters:** date (all/today/week/month/custom), product (by form), CSR (when CSRs exist), funnel, sub-brand, agent, status (Manager+)
- **Views:** Funnel (ads) vs Business (full ROI) toggle for Manager+
- **DashboardSummary:** core metrics via `dashboardMetrics.ts`; CSR auto-scope via `csrScopeFilter`
- **Loss panel:** undelivered count, would-be sales, estimated allocated ad spend, failed-delivery cost, status breakdown
- **Role layouts:** CRS → NewOrders + AbandonedCarts; others → LatestDeliveries + ActivityFeed; Manager+ → DeliveryRateByLocation + loss panel
- **Health tonation:** green/amber/red on delivery rate, ROAS, profit, business ROI, real CPA
- **No ad spend:** CPA/ROAS hidden with explanatory banner
- **Red-flag alerts:** six watchers (delivery rate, ROAS, real CPA, profit/order, business ROI, undelivered loss) → header bell + dashboard banner; owner thresholds in Organization Settings
- **Metric explainers:** tap KPI cards for formula, profit waterfall, ROAS vs Business ROI split
- Metrics: generated/delivered, delivery rate, AOV, Platform/Real CPA, COGS, delivery fee, profit per order, total profit, ROAS, Business ROI
- Delivered = `completed`/`delivered`; ad spend from `unified_expenses` advertising category
- Delivery rate by location respects date filter

### Spec target

- **Two views:** funnel-level (ads in isolation) vs business-level (all operational expenses, true ROI)
- **10 metrics** (listed in spec §3) — all filter-recalculate
- **Loss panel:** “what you’re losing” — undelivered count, would-be sales, allocated ad spend, failed-delivery cost, diagnostics by location/agent/funnel/reason
- **Red-flag alerts** (6 watchers, owner-set thresholds)
- **Colour tonation** green/amber/red tied to thresholds
- **Role scope:** CRS own / manager team / admin all money
- Filter by status, year, month, product, funnel, agent, source, sub-brand, date range, **ad platform**
- Metric explainers on tap; delivery rate by location

### Gap checklist

| Priority | Task | Notes |
|----------|------|-------|
| P0 | Verify **metric formulas** match spec exactly | Single source: `dashboardMetrics.ts`; audit against Excel `Quickbuy (NG).xlsx` |
| P0 | **ROAS vs Business ROI** never merged in UI | ✅ Separate labels; business view only for ROI |
| P0 | **Platform CPA** = ad spend ÷ generated; **Real CPA** = ad spend ÷ delivered | ✅ |
| P0 | Profit metrics use **delivered only** | ✅ via `isDeliveredStatus()` |
| P1 | **Funnel-level vs business-level toggle** | ✅ Funnel / Business view toggle on dashboard |
| P1 | **Loss panel** component | ✅ `LossPanel.tsx` + `fetchLossMetrics()` |
| P1 | Extend filters: funnel, agent, source, sub-brand, status, ad platform | ✅ funnel, agent, sub-brand, status (ad platform deferred) |
| P1 | **Health colour tonation** on metric cards | ✅ delivery rate, ROAS, profit, ROI, real CPA |
| P2 | **Red-flag alerts** → notification bell | ✅ Six watchers + header bell; thresholds in org settings (localStorage) |
| P2 | **No ad spend** valid state | ✅ Hide CPA/ROAS; info banner |
| P2 | **Brand name** on dashboard | ✅ Org name in title |
| P2 | Role-scoped metric queries | ✅ `csrScopeFilter()` in services via scope |
| P3 | Metric tap → explainer modals | ✅ Profit waterfall, ROAS/ROI split |

### Dependencies

- Orders data quality (§1), Expenses categories (§8), ad spend attribution (partial until Media Buyers — manual ad entry OK)

---

## 4. Wallet (Remittance)

**Route:** `/wallet` (legacy `/remittance` redirects)  
**Key files:** `src/components/wallet/*`, `src/services/wallet.ts`, `src/types/wallet.ts`

### Built today ✅⚠️

- Manager/Admin/Owner only
- **Agent-per-day remittance lines** — orders grouped by agent + calendar day
- **Expected remittance** = delivered value − delivery fee (agent keeps) − net-offs
- Only **`agent_collected`** orders (`money_received_by`) enter Wallet
- States: **standing**, **remitted**, **short**, **net owed to agent**
- Mark remitted with **actual amount**; shortfall stays on line
- **Net-off** creates operational expense + reduces expected remittance
- Filters: date, agent, sub-brand, status, search
- Summary: delivered value, expected, remitted, **cash gap (outstanding)**
- Persisted lines in `wallet_remittance_lines` (apply migration)

### Spec target

- **Unit: agent-per-day** — all agent-collected deliveries in a day → one remittance line
- **Expected remittance** = delivered value − delivery fee (agent keeps) ± net-offs (business owes agent)
- Only **`agent collected`** orders enter Wallet
- States: standing, remitted, short, net owed to agent
- Manager marks remitted; accountant pinged (non-blocking)
- Failed deliveries → expenses, not Wallet

### Gap checklist

| Priority | Task | Notes |
|----------|------|-------|
| P0 | Restructure from **per-order to per-agent-per-day** lines | ✅ Aggregate + `wallet_remittance_lines` |
| P0 | Compute **expected remittance** from order economics | ✅ delivery fee from order; not re-booked as expense |
| P0 | Gate rows on **money-received = agent collected** | ✅ `entersWalletRemittance()` |
| P1 | **Record actual amount**; shortfall stays standing | ✅ RecordRemittanceDialog |
| P1 | **Net-off:** business owes agent → expense + deduction on line | ✅ NetOffDialog + unified expense |
| P1 | Filters: agent, day, sub-brand, standing vs remitted | ✅ |
| P2 | Accountant notification on mark remitted | ❌ Bell/email when notifications layer ready |
| P2 | **Cash gap** summary for Accounting | ✅ Outstanding KPI card |

### Dependencies

- Orders money-received flag (§1), mark-delivered flow

---

## 5. Waybills

**Route:** `/waybills` → `DeliveriesForm`  
**Key files:** `src/components/DeliveriesForm.tsx`, `src/components/deliveries/*`, `src/services/deliveries.ts`  
**Hidden route:** `/import` → `ImportWaybills` (not in sidebar)

### Built today ✅

- CRUD: date, CSR, agent, product, quantity, cost, waybilling fee
- Status: `Waybilled` | `Delivered` (logistics — distinct from order `completed`)
- Batch waybill dialog; activity logging

### Spec target

- Waybill = stock-in to agent; **fee only** to expenses (not product cost at waybill time)
- Status: waybilled (in balance) → delivered (leaves balance when order delivers)
- Dated, attributed trail

### Gap checklist

| Priority | Task | Status | Notes |
|----------|------|--------|-------|
| P0 | **Waybill fee → operational expense** auto-feed | ✅ Done | `waybillIntake.ts` → `createUnifiedExpense` (`logistics_delivery_fees`); product cost not expensed |
| P0 | **Waybill → stock_movement** increases agent holding | ✅ Done | `intakeWaybill` / `intakeWaybillBatch` → `bulkWaybillToAgent` + `legacy_delivery_id` link |
| P1 | Filters: agent, product, status, month, sub-brand | ✅ Done | `DeliveryTable` + `DeliveriesForm`; migration adds `deliveries.sub_brand` |
| P2 | Surface **Import waybills** in nav | ✅ Done | `navigation.ts` → `/import` (Manager+) |
| P2 | Align waybill “Delivered” semantics with balance roll-up | ✅ Done | Monthly summary uses `cost` by status; `Delivered` = leaves balance (logistics, not order `completed`) |

**Migration:** `supabase/migrations/20260720160000_waybill_stabilization.sql` (`sub_brand`, `waybill_batch_id` on `deliveries`).

---

## 6. Agents

**Route:** `/agents`, `/agents/:agentId`  
**Key files:** `src/components/AgentsForm.tsx`, `AgentDetailPage.tsx`, `src/services/agents.ts`

### Built today ✅⚠️

- CRUD agents with Nigerian states + custom locations
- Active/inactive toggle (`setAgentActive`)
- Agent detail: stock ledger link
- **Not** staff — correct separation

### Spec target

- List: location, stock held, delivery rate
- Record: contact (person, phone, email), stock, delivery rate, remittance history
- Warehouse = holder-only agent
- Agents do not log in (records only)

### Gap checklist

| Priority | Task | Status | Notes |
|----------|------|--------|-------|
| P1 | Show **current stock held** on list/record | ✅ Done | `agentMetrics.ts` + `AgentTable` / `AgentDetailPage` summary |
| P1 | Show **delivery rate** on agent record | ✅ Done | Orders assigned → delivered %; warehouse shows — |
| P1 | Link **remittance history** from Wallet | ✅ Done | `AgentRemittanceHistory` + `/wallet?agent={id}` deep link |
| P1 | **Contact fields** on agent record | ✅ Done | Migration `20260720170000_*`; create/edit dialog + detail card |
| P2 | **Deactivate agent** UX polish | ✅ Done | Hide inactive toggle; inactive row styling; assignment excludes inactive via `agentFilters` |
| P2 | Mark **warehouse agent** distinctly | ✅ Done | Warehouse badge on list + detail; waybill batch uses `filterStockHolders` |

---

## 7. Delivery Analytics

**Route:** `/delivery-analytics`  
**Key files:** `src/components/deliveryAnalytics/DeliveryAnalyticsPage.tsx`, `src/services/deliveryAnalytics.ts`

### Built today ✅⚠️

- Manager+ only
- Overview KPIs, delivery rate by location, waybill statistics by state, monthly summary
- Merged legacy `/reports`, `/summary`, `/waybill-statistics`

### Spec target

- Headline: waybilled value, delivered value, **balance**, delivery rate
- Balance = waybilled − delivered per period (negative balance valid)
- Filters recalculate all; breakdown by agent, location, product

### Gap checklist

| Priority | Task | Status | Notes |
|----------|------|--------|-------|
| P0 | **Balance roll-up** column per month | ✅ Done | `MonthlySummaryTable` balance = waybilled − delivered |
| P1 | Treat **negative balance** as normal | ✅ Done | Neutral balance styling + helper copy |
| P1 | Unified filters: agent, location, product, sub-brand, status, time frame | ✅ Done | `DeliveryAnalyticsFiltersBar` drives all sections |
| P1 | Merge performance + roll-up in one page | ✅ Done | Headline KPIs + location + breakdown + monthly table |
| P2 | Drill-down by agent / location / product | ✅ Done | `DeliveryBreakdownTable` tabs |

---

## 8. Order Forms

**Routes:** `/forms`, `/forms/create`, `/forms/:id/edit`  
**Key files:** `src/components/FormsForm.tsx`, `FormBuilderPage.tsx`, `public/embed.js`, `supabase/functions/create-order-from-form`

### Built today ✅⚠️

- Form list, create/edit builder, embed token, WordPress shortcode copy
- Active/inactive toggle; RBAC on create/edit
- Package/radio options with products, quantities, prices
- Submissions create orders via edge function

### Spec target

- Real form builder: required/optional fields, conditional logic, multi-product / order bump
- Validation (phone format, anti-bot)
- Redirect/confirmation on submit (thank-you, custom URL with field passthrough)
- Completed submit → order status **`new`**, funnel-tagged
- Pricing server-authoritative; location drives delivery fee
- Form reveals product **offers** (defined on product, not on form)

### Gap checklist

| Priority | Task | Status | Notes |
|----------|------|--------|-------|
| P0 | New submissions create orders with status **`new`** (not `pending`) | ✅ Done | Migration `20260720180000_*`; edge function returns `new` |
| P0 | Stamp **funnel/offer** on created order | ✅ Done | Form `funnel_name`/`sub_brand` + trigger; `offer_name` from selected package |
| P1 | **Conditional logic** in builder | ✅ Done | `showWhen` on fields; embed visibility |
| P1 | **Order bump / multi-product** in builder | ✅ Done | `order-bump` field type with attached products |
| P1 | **Redirect/confirmation** options | ✅ Done | Schema `confirmation`; embed redirect/message + `{{field}}` tokens |
| P1 | **Phone validation** + required field enforcement | ✅ Done | `phoneValidation.ts` + embed + edge function schema validation |
| P2 | Location → **delivery fee** lookup | ⏸ Deferred | Delivery configuration (Storefront-related — manual fee OK interim) |
| P2 | Form builder UI cleanup | ⏸ Deferred | Developer Brief medium priority |
| P3 | Auto-WhatsApp on submit | ⏸ Deferred | Q3 / messaging layer |

---

## 9. Abandoned Carts

**Route:** `/abandoned-carts`  
**Key files:** `src/components/AbandonedCartsForm.tsx`, `src/services/abandonedCarts.ts`

### Built today ✅

- List, filter, edit, delete
- **Convert to order** (`createCustomerOrderFromAbandonedCart`)
- Mark converted

### Spec target

- Capture partial forms with contact detail only
- Recover → normal order in pipeline
- Auto-WhatsApp on abandon (when messaging connected)
- Filters: funnel, product, date, status

### Gap checklist

| Priority | Task | Status | Notes |
|----------|------|--------|-------|
| P0 | **End-to-end verify** convert → order → deliver → metrics | ✅ Done | Convert creates `customer_orders` with status `new`, line items, attribution; `converted_order_id` FK fixed |
| P1 | Reject carts **without contact** at capture | ✅ Done | Embed + edge function; DB insert policy requires name + phone/WhatsApp |
| P1 | Filters: funnel, product, date, status | ✅ Done | Funnel/product dropdowns; date + conversion status retained |
| P2 | Auto-WhatsApp recovery | ⏸ Deferred | Phase Next messaging |
| P2 | Dashboard widget accuracy for CSR | ✅ Done | Widget excludes converted + contactless rows; richer product label |

---

## 10. Follow-Ups

**Route:** `/follow-ups`  
**Key files:** `src/components/FollowUpsForm.tsx`, `src/services/followUps.ts`, `followUpAnalytics.ts`, `customerRelationsLeaderboard.ts`

### Built today ✅⚠️

- CRUD, assign CSR, status/priority/outcome
- Analytics + leaderboard, SLA metrics
- In-app notifications component

### Spec target

- CRS task list after auto-message (or direct if no messaging)
- States: awaiting follow-up → followed up (time recorded) → resolved (converted / not converted)
- **Follow-up timing** as CRS performance signal
- Role-scoped lists

### Gap checklist

| Priority | Task | Status | Notes |
|----------|------|--------|-------|
| P1 | Align statuses with spec: **awaiting / followed up / resolved** | ✅ Done | Migration + UI labels; legacy values normalized on read |
| P1 | Record **time-to-act** from cart landing to CRS action | ✅ Done | `response_time_minutes` from `abandoned_at` → `first_contact_at` |
| P1 | Explicit **convert / not converted** outcomes | ✅ Done | Resolved requires `converted` or `not_converted`; quick actions on rows |
| P2 | Tie follow-ups to abandoned carts pipeline | ✅ Done | DB trigger on `abandoned_carts` insert; convert closes linked follow-ups |
| P2 | Manager view of team timing | ✅ Done | Leaderboard visible to Manager+ (was Owner-only) |

---

## 11. Products

**Route:** `/products`  
**Key files:** `src/components/ProductsForm.tsx`, `src/services/products.ts`, `PriceDialog.tsx`, `ReceiveStockDialog.tsx`

### Built today ✅

- Product CRUD: name, SKU, type (`NORMAL` | `INCENTIVE`), base/cost price, active flag, category, sub-brand, low-stock threshold
- **Variants** (`product_variants`) with own price/cost; optional variant on inventory lots
- **Typed offers** (`product_offers`): single, quantity tier, bundle, buy-X-get-Y — many concurrent offers per product
- Capability toggles: variants / bundles / discounts
- Stock on list from **inventory lots** (no duplicate counter)
- Performance columns: units sold, revenue, margin
- Receive stock → FIFO inventory lots (variant-aware)
- Form builder attaches products to radio options; inactive products stripped on load
- Legacy price history retained; new pricing via offers

### Spec target

- Parent product + **variants** (own cost, price, stock line) + **offers** (quantity tier, bundle, single, buy-X-get-Y)
- Toggle capabilities per product: variants, bundles, discounts
- Many offers at once; accord rule (true unit count including free units)
- Products show stock from Inventory (no duplicate stock number)
- Category, sub-brand, performance/margin on list

### Gap checklist

| Priority | Task | Notes |
|----------|------|-------|
| P1 | Model **variants** as first-class (not only price tiers) | ✅ `product_variants` + VariantsDialog |
| P1 | Model **offer types** explicitly | ✅ `product_offers` + OffersDialog (single, tier, bundle, buy-X-get-Y) |
| P1 | **Buy-X-get-Y true unit count** in orders/inventory/COGS | ✅ Accord columns + RPC uses `true_unit_count` for FIFO |
| P1 | **Product deactivation** | ✅ Anon RLS `active=true`; form builder strips inactive attachments |
| P2 | Category + sub-brand on product | ✅ ProductDialog fields |
| P2 | Performance columns on list | ✅ units sold, revenue, margin from order line items |
| P2 | Capability toggles per product | ✅ allows_variants / bundles / discounts |

---

## 12. Expenses

**Route:** `/expenses` (legacy `/crs` → `?tab=agent`)  
**Key files:** `src/components/UnifiedExpensesForm.tsx`, `src/services/unifiedExpenses.ts`, `expenseSummary.ts`

### Built today ✅

- Unified `unified_expenses` hub with tabs: Operational, Building, Marketing, Advertising, Agent costs
- Org vs agent scope; summary cards with ROAS / expense ratios
- Manual entry CRUD with **attribution** (product + offer name; required for advertising)
- **Auto-feeds** (idempotent): waybill fees, failed delivery, wallet net-off
- **Custom subcategories** per org under each parent category
- **Expense report** — stacked bar chart over time by category
- Auto-fed rows tagged; amount locked on edit (notes/attribution editable)

### Spec target

- **Hub:** auto-feeds from ad spend, contractor pay, waybill fees, failed-delivery/agent costs + direct entry
- Four parents: operational, advertising, marketing, building — custom sub-categories
- No double-counting (COGS + delivery fee on successful orders stay in order profit)
- Advertising attribution mandatory (product/offer/platform); marketing should; operational optional
- Expense report visual over time

### Gap checklist

| Priority | Task | Notes |
|----------|------|-------|
| P0 | Auto-feed **waybill fees** from Waybills | ✅ Idempotent via `source_type=waybill_fee` |
| P0 | Auto-feed **failed delivery** from Orders action | ✅ Idempotent via `source_type=failed_delivery` |
| P1 | Auto-feed **agent net-off** from Wallet | ✅ `wallet_net_off` source linkage |
| P1 | **Sub-category** CRUD under each parent | ✅ `expense_subcategories` + dialog add |
| P1 | Enforce **attribution rules** by category | ✅ Block advertising without product/offer |
| P1 | **Expense report** view (charts over time) | ✅ `ExpenseReportChart` on hub |
| P2 | Edit auto-fed rows (inherit attribution, editable) | ✅ Amount/date locked; note/attribution editable |
| P2 | Remove/archive legacy `ExpensesForm` / `GeneralExpensesForm` | Deferred — deprecated in `legacy/README` |

---

## 13. Organization Settings & Order Assignment

**Route:** `/organization-settings`  
**Key files:** `OrganizationSettingsPage.tsx`, `OrderAssignmentSettings.tsx`, `organizations.ts`, `organizationInvitations.ts`

### Built today ✅⚠️

- Switch/rename org, default org on sign-in
- Members: list, change role, remove
- Invitations: send, revoke, resend; accept flow
- **Order assignment:** round-robin + weighted % + exclude CSR (`OrderAssignmentSettings`)
- Theme toggle
- **Stub:** email notification preferences (toast only, no persistence)

### Spec target (11b Order Assignment)

- Round-robin or by-percentage; exclude CRS temporarily
- Settable per business

### Gap checklist

| Priority | Task | Notes |
|----------|------|-------|
| P0 | Verify assignment runs on **new order intake** | ✅ `pick_csr_for_order_assignment` in `create_order_from_normalized_submission`; manual orders via `getNextAssignedUser` |
| P1 | **Exclude CSR** UX matches spec (pause from rotation) | ✅ `is_paused` on weights; UI labels "Exclude from rotation" |
| P2 | Notification preferences persistence | Depends on Notifications layer (Phase Next) |
| P2 | Alert threshold defaults storage | ✅ localStorage per org; DB sync deferred |

---

## 14. Auth & Profile

**Routes:** `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`, `/terms`, `/privacy`, `/profile`, `/select-organization`, `/accept-invitation`

### Built today ✅

- Full auth + email OTP verification
- Forgot/reset password (edge functions)
- Org selection, multi-org switch, invitations
- Terms & Privacy pages
- Profile page (basic)

### Spec target (Settings §24 subset)

- Profile: name, email, password, business logo, phone/WhatsApp, timezone, currency

### Gap checklist

| Priority | Task | Notes |
|----------|------|-------|
| P1 | **Email integration** production-ready | ✅ Brevo wired; UI surfaces send failures; configure secrets + sender domain for prod |
| P2 | Profile: timezone, currency, logo, WhatsApp | ✅ Profile: phone/WhatsApp/timezone + password change; Org settings: logo/timezone/currency |
| P2 | Subscription/billing | Phase Next (§24 full) |

---

## Recommended stabilization order

1. **Data model alignment** — order statuses, money-received flag, funnel/offer tags, single order source  
2. **Orders + Inventory coupling** — mark delivered → stock movement  
3. **Dashboard metrics audit** — formulas, filters, funnel/business toggle, loss panel  
4. **Wallet refactor** — agent-per-day remittance  
5. **Expenses auto-feeds** — waybill fee, failed delivery, wallet net-off  
6. **Delivery Analytics balance** — waybilled vs delivered roll-up  
7. **Order Forms → Orders** — status `new`, validation, conditional logic  
8. **Products offer/variant model** — unblocks forms and future performance  
9. **Abandoned carts E2E test + follow-up timing**  
10. **Cleanup** — legacy components, test data flush, nav polish  

---

## Verification checklist (sign-off)

Before calling Phase Current stable:

- [ ] Delivered count on Dashboard = Orders list delivered count = Delivery Analytics delivered value source
- [ ] Mark delivered on order reduces correct agent stock by correct quantity
- [x] Waybill creates stock-in + fee expense only (not product COGS expense)
- [ ] Failed delivery from order creates expense + affects delivery rate
- [ ] Wallet only shows agent-collected COD; prepaid/company-paid orders excluded
- [ ] ROAS and Business ROI displayed separately; CPA uses correct denominators
- [ ] CRS sees only own orders/follow-ups; Manager+ sees team/org per spec
- [ ] Abandoned cart → convert → deliver appears in metrics
- [ ] No cross-org data leakage (RLS + UI org filter)
- [ ] Sample/test data flushed or signed off (`ORDER-DATA-FLUSH-STRATEGY.md`)

---

*Last aligned to feature spec working draft (59 pages). Update this file when spec sections change.*
