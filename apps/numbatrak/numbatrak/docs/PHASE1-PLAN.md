# Phase 1 — Stabilisation Plan

Reference: `outline/Numbatrak_Developer_Brief_v1.pdf`, `outline/Numbatrak_Dashboard_Feature_Spec_v1.pdf`, `outline/Quickbuy (NG).xlsx`.

**Goal:** Make everything that already exists work correctly. Target: end June / early July 2026. In-house use by mid-July.

---

## Dashboard — 10 core metrics (Critical)

All metrics filter by **product/form** and **date range** (Today, This Week, This Month, Custom).

| # | Metric | Formula | Current gap |
|---|--------|---------|-------------|
| 1 | Total Orders Generated | COUNT orders in period (`created_at`) | OK source (`form_responses`) but mixed with legacy `orders` table |
| 2 | Total Orders Delivered | COUNT where status = delivered | App uses `completed`; was conflated with agent `deliveries` table |
| 3 | Delivery Rate | delivered ÷ generated × 100 | Missing card |
| 4 | AOV | Σ sales (delivered) ÷ delivered count | Missing; must use `order_revenue` on delivered only |
| 5 | Platform CPA vs Real CPA | ad spend ÷ generated; ad spend ÷ delivered; gap | Only one CPA shown; counts split across `customer_orders` / `form_responses` |
| 6 | Average COGS | Σ `order_cost` (delivered) ÷ delivered | Missing |
| 7 | Average Delivery Fee | Σ `delivery_fee` (delivered) ÷ delivered | Missing |
| 8 | Profit Per Order | AOV − Real CPA − Avg COGS − Avg Delivery Fee | Missing |
| 9 | Total Profit (Delivered) | profit per order × delivered | Label said “profit” but may reflect revenue; uses `form_responses.profit` not component formula |
| 10 | ROAS vs Business ROI | revenue ÷ ad spend; net profit ÷ total investment | Missing; must never merge |

**Implementation:** `src/services/dashboardMetrics.ts` — single source of truth. UI: `DashboardSummary.tsx`.

**Delivered = `status = 'completed'`** on `form_responses` / `customer_orders` (maps to Excel `Order_Status` / confirmed delivery). The agent **`deliveries`** table (Waybilled/Delivered) is inventory/logistics — not customer order delivery counts.

---

## Phase 1 task checklist (from Developer Brief §09)

| Task | Priority | Status |
|------|----------|--------|
| Email integration (SendGrid/Brevo) | Critical | Not started |
| Forgot-password flow | Critical | Not started |
| Navigation restructure (grouped sidebar) | Critical | Not started |
| Dashboard metric accuracy | Critical | **In progress** |
| Terms of Service & Privacy Policy | Critical | Not started |
| Delivery Analytics merge (Summary + Waybill Stats) | High | Not started |
| Wallet (rename Remittance + remittance flow) | High | Not started |
| Agent deactivation | High | Not started |
| Product deactivation | High | Not started |
| Abandoned cart — verify end-to-end | High | Not started |
| Sample/test data cleanup | High | **Strategy doc + audit SQL** |
| Order form UI cleanup | Medium | Partial |
| Dashboard brand name (not “Numbatrak”) | Medium | Not started |

---

## Excel template mapping (`Quickbuy (NG).xlsx`)

Per-agent sheets + **Inventory**, **Product_Shipping**, **Expenses**, **Expenses_Report**, **Total**.

Order columns align to Numbatrak fields:

| Excel column | DB field |
|--------------|----------|
| Customer_name | `customer_name` |
| Phone_number | `phone_number` |
| Order_Date | `created_at` |
| Sales_Price | `order_revenue` |
| Cost_Price | `order_cost` |
| Delivery_Fee | `delivery_fee` |
| Profit | `profit` (net: revenue − COGS − delivery fee) |
| Order_Status / Confirmed_Delievery | `status` → `completed` when delivered |
| Product / Product_Name | `form_id` / line items |

---

## Explicitly out of Phase 1 scope

Funnel Analytics, Business Analytics (separate pages), RBAC, subscriptions, super-admin, invoicing, accounting, HR module, SMS/WhatsApp, payment gateway — Phase 2.

---

## Recommended execution order

1. **Dashboard metrics** — accurate formulas + UI (this sprint)
2. **Order data audit & flush** — dry-run report → founder sign-off → migration (see `ORDER-DATA-FLUSH-STRATEGY.md`)
3. **Email + forgot-password** — unblock invites and confirmations
4. **Navigation restructure** — before more UI work
5. **Wallet, Delivery Analytics, deactivation** — high-priority stabilisation
6. **ToS/Privacy + test data purge** — before any external tenant
