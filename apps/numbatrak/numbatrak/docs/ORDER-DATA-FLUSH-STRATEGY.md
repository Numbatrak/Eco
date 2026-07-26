# Order Data Flush Strategy

**Purpose:** Clean existing order records so dashboard metrics (AOV, COGS, CPA, profit) match the Excel template and Feature Spec v1.

**Principle:** Never delete production data without a dry-run report and org-scoped approval. Order economics are immutable snapshots — we **fix missing snapshots** and **remove junk rows**, not recompute historical prices from the live catalog.

---

## What “delivered” means

| Source | Meaning |
|--------|---------|
| `form_responses.status = 'completed'` | Customer order delivered (use for metrics #2–10) |
| `customer_orders.status = 'completed'` | Same, synced from form response |
| `deliveries.status = 'Delivered'` | Agent stock movement — **not** order delivery count |

---

## Audit categories (run per organisation)

Use `scripts/order-data-audit.sql` in Supabase SQL editor. Replace `:org_id` with the target organisation UUID.

### A — Rows to **delete** (after review)

- Test/demo customers: name/phone patterns (`test`, `demo`, `sample`, `xxx`, repeated digits)
- Duplicate submissions: same `phone_number` + `form_id` + `created_at` within 1 minute
- `response_type = 'order'` with empty `customer_name` AND empty `phone_number` AND no line items
- Orphan `customer_orders` with no matching `form_response_id` and `source = 'form'`
- Legacy `orders` table rows if org has fully migrated to `form_responses`

### B — Rows to **fix in place** (recalculate snapshots)

- `status = 'completed'` but `order_revenue` IS NULL → sum from `form_response_items.total_price`
- `order_cost` IS NULL on completed orders → sum from `form_response_items.total_cost`
- `delivery_fee` IS NULL but field_values contain delivery fee → backfill from JSON
- `profit = 0` on completed orders with revenue > 0 → run DB functions:
  - `order_profit = compute_form_response_gross_profit(order_revenue, order_cost)`
  - `profit = compute_form_response_net_profit(order_revenue, order_cost, delivery_fee)`
- `completed_at` IS NULL where `status = 'completed'` → set from `updated_at` or manual delivery date

### C — Rows to **reclassify** (status fix)

- `pending` orders older than 90 days with no activity → mark `cancelled` (not deleted) OR leave for manual review
- `completed` without confirmed delivery in notes — flag for CSR review, do not auto-delete

### D — **Do not touch**

- Cancelled orders (keep for generated-count history if spec requires all entered orders)
- Orders with correct snapshots (even if profit is negative)
- Abandoned carts (`response_type = 'abandoned_cart'`) unless explicitly test data

---

## Flush procedure

```
1. EXPORT   → pg_dump or CSV export for org (form_responses, form_response_items, customer_orders)
2. AUDIT    → Run audit SQL; save result sets
3. REVIEW   → Founder/ops sign-off on delete vs fix lists
4. DRY-RUN  → Wrap fixes in BEGIN … ROLLBACK; verify metric deltas in dashboard
5. APPLY    → Migration with org_id filter; log counts in migration comment
6. VERIFY   → Compare dashboard to Excel Total sheet for same date range
```

---

## Metric impact after flush

| Issue | Symptom | Fix |
|-------|---------|-----|
| Test orders in period | Inflated generated count, wrong CPA | Delete category A |
| Missing `order_revenue` | AOV = 0, ROAS wrong | Backfill from items |
| Using `deliveries` for KPI | Delivery rate ≠ order reality | UI already moving to order status |
| `profit` = revenue | Total profit overstated | Recalculate net profit |
| Duplicate form + customer_order | Double CPA denominator | Dedupe or count one source |

---

## Multi-tenant safety

- Every query MUST include `organization_id = :org_id`
- Run flush **one org at a time** for the 8 internal test brands
- RLS remains the security boundary; scripts use service role only in controlled maintenance window

---

## QuickBuy-specific note

The `outline/Quickbuy (NG).xlsx` workbook is the ground truth for formulas. After flush, pick one calendar month present in both Excel and Numbatrak and reconcile:

- Generated count = Excel order rows in month
- Delivered count = Excel rows with delivered/confirmed status
- Σ Sales_Price, Σ Cost_Price, Σ Delivery_Fee, Σ Profit

Discrepancies > 2% trigger a row-level diff, not further bulk deletes.
