# Numbatrak (Mail9ja) — Change Log: June 11, 2026

This document summarizes all work built and modified on **June 11, 2026**, across six commits on `main`. Changes span database schema, security/org scoping, order economics, UI/theming, and new platform features.

---

## Commits (chronological)

| Commit | Summary |
|--------|---------|
| `de43955` | Capture remote Postgres schema as `supabase/schema_baseline.sql` |
| `cfbbfb5` | Fix order profit miscalculation (DB functions + frontend) |
| `b1a08e9` | UI/UX: dark/light mode, pagination, brand colors, table theming |
| `48f509a` | Favicon/SEO assets, org invitations & activities, loading states, org settings |
| `2f10140` | Form Builder + OrderDialog theme alignment |
| `238856b` | Full audit fixes: schema sync, org scoping, follow-ups, security, dialog consistency |

---

## 1. Database & Supabase

### 1.1 Schema baseline

- Added **`supabase/schema_baseline.sql`** — full pg_dump-style reference of the remote database (~3,700+ lines initially; expanded to ~4,100+ by end of day).
- Baseline now includes synced definitions for:
  - **`activities`** — org-scoped audit log
  - **`organization_invitations`** — invite-by-email flow with RLS
  - **`follow_ups`** — CSR follow-up tracking (org-scoped)
  - Related functions, triggers, indexes, policies, and GRANTs

### 1.2 Migrations added

#### `20260611120000_fix_order_profit_formula.sql`

- Introduces immutable helpers:
  - `compute_form_response_gross_profit(revenue, cost)` → revenue − cost
  - `compute_form_response_net_profit(revenue, cost, delivery_fee)` → revenue − cost − delivery
- Updates **`create_order_from_normalized_submission`** RPC to snapshot economics correctly at order creation (FIFO inventory consumption unchanged).
- Clarifies distinction between **gross margin** (`order_profit`) and **net profit after delivery** (`profit`).

#### `20260612120000_activities_and_invitations.sql`

- **`organization_invitations`** table with role check, unique invitation codes, partial unique index on pending invites per org+email.
- Trigger **`set_organization_invitation_defaults`** — auto-generates invitation code, normalizes email.
- **`activities`** table — org-scoped audit entries (action_type, entity_type, description, metadata).
- RLS policies for invitations (select/insert/update/delete) and activities (select for Owner/Admin, insert for org members).
- **`accept_organization_invitation(inv_code)`** SECURITY DEFINER RPC — validates email match, expiry, adds org member.
- Policy **“Owners and Admins can view all org members”** on `organization_members`.
- Uses conditional `DO $$` blocks instead of `DROP IF EXISTS` to avoid NOTICE spam on first deploy.

#### `20260613120000_follow_ups_and_security_fixes.sql`

- **`follow_ups`** table with:
  - `order_id` **uuid** → `orders.id`
  - `abandoned_cart_id` **uuid** → `abandoned_carts.id`
  - `organization_id`, assignment, status/priority/outcome checks, SLA timestamps
- Trigger **`set_follow_up_organization_id`** — backfills org from linked order or abandoned cart.
- RLS: org members can select/insert; update limited to assignee or Owner/Admin/Manager; delete for Owner/Admin or assignee.
- **Security fix:** drops permissive `abandoned_carts` policies that used `USING (true)` for authenticated users (cross-tenant risk).

### 1.3 Edge function

- **`supabase/functions/create-order-from-form/index.ts`** — aligned with updated profit RPC semantics.

---

## 2. Security & Multi-Tenant Org Scoping

### 2.1 Client-side defense in depth

- New helper **`src/services/orgQuery.ts`** → `emptyWithoutOrg()` returns `[]` when `organizationId` is null so list queries never run unscoped.
- List/mutation services updated to require org context and return empty results without an org:
  - `agents`, `products`, `orders`, `deliveries`, `forms`, `formResponses`, `inventory`, `expenses`, `generalExpenses`, `unifiedExpenses`, `customerOrders`, `abandonedCarts`, `followUps`, `followUpAnalytics`, `customerRelations`, `customerRelationsLeaderboard`

### 2.2 Follow-ups

- **`followUps.ts`** — all CRUD scoped by `organizationId`; auto-assign pulls from `organization_members` with role `Customer Relations` (not global profiles).
- **`useCachedFollowUps`** — fixed argument order bug (org was previously passed as search query).
- **`FollowUpActions.tsx`**, **`FollowUpDialog.tsx`**, **`FollowUpsForm.tsx`** — pass org through the stack.
- Types: `order_id` and `abandoned_cart_id` are **`string | null`** (UUID), not `number`.

### 2.3 Dashboard & imports

- **`fetchWaybillsByState`**, **`fetchDeliveryRateByLocation`** — require `organizationId`.
- **`importWaybills.ts`** + **`ImportWaybills.tsx`** — require org; set `organization_id` on created records.
- **`InventoryTable.tsx`** — passes org to inventory fetches.
- **`removeInventoryByAgentAndProduct`** — adds `organization_id` filter.

### 2.4 Route guards

- New **`src/components/auth/ProtectedRoute.tsx`** — redirects to dashboard when role or permission check fails.
- **`App.tsx`** guards:
  - `/forms/create` → `forms.canCreate`
  - `/forms/:id/edit` → `forms.canUpdate`
  - `/import` → roles `Owner`, `Admin`, `Manager`

---

## 3. Business Logic & Order Economics

### 3.1 Profit display fixes

- **`formResponseHelpers.ts`** — consistent gross vs net profit helpers for UI.
- **`FormResponseTableRow.tsx`** / **`FormResponseDialog.tsx`** — completed orders show DB-snapshotted `profit` unless delivery fee is edited in-dialog.
- **`formResponses.ts`** — `profit: row.profit != null ? Number(row.profit) : 0`.
- **`dashboard.ts`** / **`dashboardProjection.ts`** — dashboard aggregates use corrected profit fields.

### 3.2 OrderDialog economics

- Catalog price recalculation runs only in **create** mode; edit mode preserves snapshotted order economics (immutable historical orders invariant).

### 3.3 Legacy webhook path

- **`orderWebhook.ts`** rewritten (no longer inserts legacy column shape into `orders`):
  - **`createAbandonedCart(data, organizationId)`** → delegates to `abandonedCarts` service → `abandoned_carts` table.
  - **`createOrderFromForm(data, organizationId, formId)`** → calls `create_order_from_normalized_submission` RPC.
- **`abandonedCarts.ts`** — sets required `abandoned_at` on insert.

> **Breaking change for WordPress/webhook integrators:** both functions now require `organizationId`; `createOrderFromForm` also requires `formId`.

---

## 4. UI / UX & Theming

### 4.1 Global table & dialog theme

- New **`src/styles/table-theme.css`** — shared tokens for tables, pagination, and **`.dialog-cancel-button`** (theme-aware cancel styling).
- Imported via **`src/main.tsx`**.

### 4.2 Pagination

- **`TablePagination`** component + **`useClientPagination`** hook + **`lib/pagination.ts`** utilities.
- Applied across major list views: agents, products, forms, deliveries, form responses, inventory stock movements, waybill statistics, unified expenses, etc.

### 4.3 Layout

- **`PageLayout`** — consistent page container sizing across module forms.

### 4.4 Form Builder & Order Dialog (commit `2f10140`)

- **`FormBuilderPage.css`** — rewritten with CSS variables (`var(--background)`, `--card`, `--primary)`, etc.).
- **`FormBuilderPage.tsx`**, **`FormBuilderDialog.tsx`** — Midnight hero (`bg-midnight`), theme tokens, `dialog-cancel-button` in footer.

- **`OrderDialog.tsx`** — `bg-card` shell, branded hero, theme-aware labels, `dialog-cancel-button`.

### 4.5 Dialog footer consistency (commit `238856b`)

`dialog-cancel-button` applied to all dialog footers:

| Component |
|-----------|
| OrderDialog, DeliveryDialog, FormResponseDialog, FormBuilderDialog |
| PriceDialog, ProductDialog, ExpenseDialog, GeneralExpenseDialog |
| InventoryDialog, TransferDialog, AbandonedCartDialog, FollowUpDialog |
| ReceiveStockDialog, WaybillBatchDialog, InvitationDialog |
| `agents/DialogFooter` (also used by FormDialog) |

### 4.6 Follow-ups & pricing theme

- **`FollowUpTable.css`** — replaced hardcoded grays/indigo (`#4f46e5`, `#e5e7eb`, etc.) with design tokens (`var(--border)`, `var(--primary)`, `var(--muted)`, etc.).
- **`PriceDialog.tsx`** — gray/indigo utility classes replaced with `text-foreground`, `text-muted-foreground`, `bg-muted`, `border-border`.

### 4.7 Branded dialogs & loading

- **`BrandedDialogShell`**, **`LoadingState`** — reusable dialog chrome and loading UI.
- Dialog heroes updated on expenses, inventory, products, agents, etc.

### 4.8 Brand assets & SEO

- **`public/favicon.svg`**, **`og-image.png`**, **`site.webmanifest`**, **`robots.txt`**
- **`index.html`** — meta tags, manifest link, favicon.

---

## 5. Organization Features

### 5.1 Invitations

- Migration + baseline sync for **`organization_invitations`**.
- **`organizationInvitations.ts`** service updates.
- **`InvitationDialog.tsx`** — redesigned; uses `dialog-cancel-button`.
- **`AcceptInvitationPage`** + **`InvitationNotification`** (existing routes wired to new RPC).

### 5.2 Activities feed

- **`activities`** table + **`activities.ts`** service hook-up.
- **`ActivityFeed.tsx`** — consumes org-scoped activity data.

### 5.3 Organization settings

- **`OrganizationSettingsPage.tsx`** / **`.css`** — layout and styling fixes.

---

## 6. Dashboard Improvements

- **`DashboardPage.tsx`**, **`LatestDeliveries.tsx`**, **`DeliveryRateByLocation.tsx`**, **`WaybillByState.tsx`** — org-scoped queries and loading states.
- Profit/remittance metrics aligned with corrected economics.

---

## 7. Developer / Project Tooling

Added (not deployed to production runtime):

- **`.cursor/rules/`** — project context rules (org scoping, RLS, immutable order economics, UI conventions).
- **`cursor-audit-prompt.md`**, **`cursorignore`**, **`pnpm-workspace.yaml`**

---

## 8. Files Changed (summary)

| Area | Approx. files | Notable paths |
|------|---------------|---------------|
| Migrations | 3 | `supabase/migrations/20260611*.sql`, `20260612*.sql`, `20260613*.sql` |
| Schema baseline | 1 | `supabase/schema_baseline.sql` (+~400 lines sync) |
| Services | 20+ | `orgQuery`, `followUps`, `dashboard`, `orderWebhook`, `abandonedCarts`, … |
| Components | 40+ | Dialogs, tables, forms, dashboard, auth |
| Styles | 5+ | `table-theme.css`, `FormBuilderPage.css`, `FollowUpTable.css` |
| Edge functions | 1 | `create-order-from-form/index.ts` |

**Total across the day:** ~120+ files touched across all six commits.

---

## 9. Deployment Checklist

1. **Apply migrations** (in order):
   ```bash
   supabase db push
   ```
   Migrations: `20260611120000`, `20260612120000`, `20260613120000`.

2. **Redeploy edge function** if using form intake:
   ```bash
   supabase functions deploy create-order-from-form
   ```

3. **Frontend** — standard Netlify/Vite build (`npm run build` verified passing).

4. **Webhook integrators** — update WordPress/custom webhooks to pass `organizationId` (and `formId` for full orders).

5. **Verify RLS** — confirm abandoned cart cross-tenant policies are gone; follow-ups and invitations respect org membership.

---

## 10. Invariants Preserved

All changes respect project invariants:

- **Org scoping** — queries and writes tied to current organization.
- **Permissions** — derived from org role, not global profile role.
- **Order economics immutable** — historical unit price, cost, and profit snapshotted at creation.
- **RLS as security boundary** — new tables ship with policies; UI hiding is not access control.

---

## 11. Known Follow-Ups (optional)

- `followUps.ts` select join may still reference `orders.phone_number`; baseline `orders` uses `customer_phone` — verify join at runtime if follow-up order display fails.
- Legacy `Order` TypeScript type still has `id: number`; production `orders.id` is UUID.
- `orderWebhook.ts` is not currently imported elsewhere in the repo; kept as a typed legacy adapter for external callers.

---

*Generated: June 11, 2026 — reflects commits `de43955` through `238856b` on `main`.*
