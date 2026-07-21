# Numbatrak Migration — Phase 1 Report (schema translation + data migration)

Scope: translate Numbatrak's current-path Supabase Postgres schema into
Drizzle tables under `packages/db/src/schema/numbatrak/`, and write a
read-only-source/idempotent data migration script. Auth/roles, Edge Function →
Fastify porting, RLS-to-permission conversion, the public embed surface, and
the frontend port are explicitly out of scope (separate later tasks).

Sources read in full to produce this: `supabase/schema_baseline.sql` (4,153
lines), all 26 dated files in `supabase/migrations/` (Feb–Jul 2026),
`docs/PHASE-CURRENT-STABILIZATION.md`, `docs/ROLE-MAPPING.md`,
`docs/ORDER-DATA-FLUSH-STRATEGY.md`, `src/legacy/README.md`, and targeted
greps across `src/services/*.ts` to confirm which tables are actually queried
by the live app (vs. present in the schema but dead).

## 1. Naming and identity decisions

- **Table prefix**: every table is named `numbatrak_*` at the SQL level.
  Required, not optional — the platform's own commerce schema already uses
  the generic names `products`, `orders`, `customers`, `expenses`, etc.
  (`packages/db/src/schema.ts`), so unprefixed Numbatrak tables would collide.
- **`organization_id` → `organization.id`**: every Numbatrak `organization_id
  uuid` column became `organization_id text references organization.id`, per
  the task's locked decision. **This assumes a target `organization` row
  already exists, one per Numbatrak org, before the data migration script
  runs** — that row's creation belongs to the auth migration phase, not this
  one. See §4.
- **User-identity columns → `user.id`**: every "who did this" column
  (`csr_id`, `assigned_to`, `recorded_by_user_id`, `created_by`,
  `remitted_by`, `user_id`, `last_assigned_user_id`) was pointed directly at
  the existing better-auth `user.id` rather than a new numbatrak-namespaced
  profile table. No `organization_members` or `user_profiles` equivalent was
  created in this phase, per task instructions. See §4 for why this is a
  bigger assumption than it looks.
- Every other column, constraint, and index was **translated, not
  redesigned** — including ones that are visibly awkward (see §3).

## 2. Table inventory

### Migrated (16 files under `schema/numbatrak/`, 25 tables)

| File | Tables | Source table(s) |
|---|---|---|
| `agents.ts` | `numbatrakAgents`, `numbatrakCsrNameAliases` | `agents`, `csr_name_aliases` |
| `products.ts` | `numbatrakProducts`, `numbatrakProductVariants`, `numbatrakProductOffers`, `numbatrakProductPriceHistory` | `products`, `product_variants`, `product_offers`, `product_price_history` |
| `forms.ts` | `numbatrakForms`, `numbatrakFormProducts` | `forms`, `form_products` |
| `orders.ts` | `numbatrakFormResponses`, `numbatrakFormResponseItems`, `numbatrakCustomerOrders`, `numbatrakCustomerOrderItems`, `numbatrakOrderInventoryConsumption` | `form_responses`, `form_response_items`, `customer_orders`, `customer_order_items`, `order_inventory_consumption` |
| `inventory.ts` | `numbatrakInventoryLots`, `numbatrakStockMovements`, `numbatrakInventoryLegacy` | `inventory_lots`, `stock_movements`, `inventory` |
| `deliveries.ts` | `numbatrakDeliveries` | `deliveries` |
| `wallet.ts` | `numbatrakWalletRemittanceLines` | `wallet_remittance_lines` |
| `expenses.ts` | `numbatrakUnifiedExpenses`, `numbatrakExpenseSubcategories`, `numbatrakAgentExpensesLegacy` | `unified_expenses`, `expense_subcategories`, `agent_expenses` |
| `abandoned-carts.ts` | `numbatrakAbandonedCarts` | `abandoned_carts` |
| `follow-ups.ts` | `numbatrakFollowUps` | `follow_ups` |
| `order-assignment.ts` | `numbatrakOrderAssignmentSettings`, `numbatrakOrderAssignmentWeights` | `order_assignment_settings`, `order_assignment_weights` |
| `activities.ts` | `numbatrakActivities` | `activities` |

**`form_responses` is not legacy** — flagging this because the task prompt's
own example ("not the legacy `orders`/`order_items`/`form_responses`") reads
as if it groups `form_responses` with the dead tables. It doesn't belong
there: `orderDataSource.ts` merges `customer_orders` with *unmigrated*
`form_responses` rows (cross-cutting item C1, "✅ Done (code)" but not "✅ data
fully migrated"), and `order_inventory_consumption.order_id` — the FIFO
inventory ledger's own FK — points at `form_responses.id`, never at
`customer_orders.id`. Both tables are current-path and both are migrated.

### Explicitly excluded — dead/orphaned, zero references in `src/` (grep-verified)

- `public.form_incentives`, `public.field_mappings` — exist in
  `schema_baseline.sql`, never queried anywhere in `src/`.
- `public.waybills` (the *other* one — bigint id, `waybill_number`, `eta`,
  `dispatched_at`/`delivered_at`, on-time/at-risk/delayed status). Distinct
  from the real "Waybills" feature, which is backed by `public.deliveries`
  (→ `numbatrakDeliveries`). Never queried in `src/`.
- `public.monthly_summary` — never queried; the Delivery Analytics page uses
  `v_monthly_delivery_summary` (a view, computed on read — see §5) instead.

**Recommendation**: confirm with a human before deciding these are truly
dead (e.g. check for any external reporting tool or scheduled job reading
them directly), but do not carry them forward by default.

### Explicitly excluded — per task instruction, but not fully inert

- `public.orders`, `public.order_items` (the legacy bare tables, distinct
  from `customer_orders`/`customer_order_items`). Per task scope these are
  the example of what *not* to migrate. However: **`src/services/orders.ts`
  and `src/services/followUps.ts` still query `orders` directly** —
  `followUps.ts` does a live PostgREST embed `order:orders(id, customer_name,
  customer_phone)` and a direct `.from("orders").select(...).eq("id",
  followUp.order_id)`. This is not fully dead code, and `follow_ups.order_id`'s
  FK in the source DB targets this exact table (see next item). A human
  should confirm no organization is depending on this path for real orders
  before treating it as safe to leave behind.

### Migrated as-is despite being nominally deprecated (dual-model, unreconciled)

Per `docs/PHASE-CURRENT-STABILIZATION.md` cross-cutting item **C8**
("Dual inventory model... Ledger tab default; deprecation banner on legacy
totals tab") these are *not* fully retired — confirmed by grep, both are
still actively read/written by the live app:

- `numbatrakInventoryLegacy` ← `public.inventory` (flat per-agent/product
  totals). Still fully wired up in `src/services/inventory.ts` (select,
  upsert, update — not read-only). Was also force-emptied at least once
  historically by `scripts/migrations/007_inventory_product_id_uuid.sql`
  ("DELETE FROM public.inventory" to change a column type), so any org that
  hasn't re-populated it since may have stale/empty data here regardless.
- `numbatrakAgentExpensesLegacy` ← `public.agent_expenses`. Still queried in
  `src/services/expenses.ts`. `unified_expenses.legacy_agent_expense_id` is a
  soft dedup/provenance backlink to it (no hard FK in source).

**Recommendation**: run a reconciliation query (ledger-computed on-hand via
`stock_movements` vs. `inventory.total_quantity`, per org/product/agent)
before deciding whether these can be dropped post-migration or need to keep
being written to indefinitely.

## 3. Schema anomalies found (preserved verbatim, not "fixed")

These are real inconsistencies in the *live* source schema/app, not
introduced by this translation. Each is called out in a code comment at its
column, and repeated here because they're easy to miss:

1. **`form_responses.agent_id` is typed `uuid` in every version of the
   schema I read (baseline through the latest migration), but app code reads
   it as a number** — `services/formResponses.ts`, `orderIntake.ts`,
   `customerOrders.ts` all do `Number(row.agent_id)`. No FK exists either
   way. This needs a live-data check (`SELECT agent_id FROM form_responses
   WHERE agent_id IS NOT NULL LIMIT 20`) before deciding what the column
   actually holds in production — the declared type and the app's runtime
   expectation contradict each other.
2. **`customer_orders.abandoned_cart_id` is `text` with no FK**, even though
   it holds an `abandoned_carts.id` (uuid) value — a soft reference the app
   maintains itself. Preserved as `text`, no FK, per "translate don't fix."
3. **`deliveries.product_id` is `bigint` with no FK to `products.id`
   (uuid)** — and the app's own type comment says it outright:
   `types/delivery.ts`: `/** deliveries.product_id (legacy int or UUID
   depending on deployment) */`, with call sites doing `String(row.product_id)`
   defensively. This means **different rows in the same production column
   may hold different reference schemes depending on when that org's data was
   entered** — a real, acknowledged-by-the-app data-quality landmine for the
   "Waybills" feature. The migration script copies the raw value through
   verbatim; a human needs to inspect real data before this can be trusted
   for anything beyond display.
4. **`wallet_remittance_lines.agent_id` is `integer`, referencing
   `numbatrak_agents.id` which is `bigint`** — a narrower FK type than its
   target. Only "works" today because agent ids haven't exceeded the int4
   range. Preserved as-is.
5. **`follow_ups.order_id`'s FK targets the legacy `orders` table** (see §2)
   — never repointed to `customer_orders`, unlike
   `abandoned_carts.converted_order_id`, which *was* explicitly repointed by
   migration `20260720190000`. Since `orders` is out of scope, this column is
   carried over with **no FK at all**. A human must decide: repoint at
   `customer_orders` with a backfill, or drop it (auto-created follow-ups —
   the common path — only ever populate `abandoned_cart_id`, never
   `order_id`, per `auto_create_follow_up_for_abandoned_cart()`).
6. **Three partial index predicates never got updated when the order status
   pipeline grew a `delivered` terminal status alongside `completed`**
   (`is_order_delivered_status()` treats both as "delivered", but these three
   indexes still filter on the literal string `'completed'`):
   `idx_form_responses_profit_completed`, `idx_form_responses_wallet`,
   `idx_customer_orders_wallet`. By contrast, `idx_customer_orders_money_received`
   *was* correctly dropped and recreated against the two-status predicate.
   Preserved exactly as found (this is a performance/coverage concern, not a
   correctness one — the underlying queries still work, they may just not
   use these particular indexes for `'delivered'` rows).
7. **`schema_baseline.sql`'s provenance is unclear**: it contains
   `form_responses.csr_id` (added by the *last* dated migration,
   `20260720230000`) while missing `payment_method`/`wallet_status`
   (`20260629150000`) and `funnel_name`/`sub_brand`/`money_received_by`
   (`20260720120000`) — columns that logically precede `csr_id` in the
   timeline. The baseline file is not a clean point-in-time snapshot;
   don't use it alone to reconstruct "what does production look like today"
   — always fold in the numbered migrations on top of it, as this report and
   the schema files do.

## 4. Open cross-phase decisions (need a human, not a guess)

1. **Organization id mapping.** If the auth-migration phase preserves each
   Numbatrak org's original Supabase uuid as the new `organization.id`
   value, the data migration script's default (identity passthrough) is
   correct. If it generates fresh ids, `ORG_ID_MAP_PATH` must be supplied.
   **This is the single most consequential undecided thing in this phase** —
   every table's `organization_id` FK depends on it, and getting it wrong
   silently mass-skips every row (the script fails closed: an org id that
   doesn't resolve in the target `organization` table is skipped and counted,
   never inserted with a dangling reference).
2. **User id mapping.** Same shape of problem for every "who did this"
   column — see `USER_ID_MAP_PATH` in the script. Lower blast radius than
   #1 (most of these columns are nullable and get NULLed out rather than
   blocking the row), except `numbatrak_activities.user_id` and
   `numbatrak_csr_name_aliases.user_id`, which are `NOT NULL` and will skip
   the whole row if unresolved.
3. **Role/permission model.** Untouched in this phase by design
   (`organization_members`'s CRS/Manager/Admin/Owner roles →
   owner/admin/member mapping is `docs/ROLE-MAPPING.md`'s job, for the auth
   phase). Numbatrak's per-org role model has no analog in the target
   `permissions`/`tenant_member_permissions` scheme yet.
4. **`inventory` and `agent_expenses` reconciliation** (§2) — decide before
   or shortly after cutover, not blocking this phase, but flagged so it
   doesn't get silently forgotten once the migration "looks done."

## 5. Business logic left behind on purpose (not a Drizzle concern, but don't lose track of it)

Numbatrak encodes a lot of real business logic in Postgres
functions/triggers, none of which has a Drizzle/schema equivalent — it all
needs to become application code in `apps/api` in the Fastify-porting phase:

- `create_order_from_normalized_submission(...)` — the whole order-intake
  RPC: FIFO lot consumption, typed-offer resolution (single/quantity-tier/
  bundle/buy-X-get-Y with the "accord" true-unit-count rule), CSR
  auto-assignment, form attribution stamping. This is the single largest
  piece of logic to port.
- `compute_form_response_gross_profit` / `compute_form_response_net_profit`,
  `extract_form_response_constants()`, `update_form_response_profit()`,
  `set_customer_order_profit_on_status()` — profit computation triggers.
- `init_wallet_status_on_delivery()`, `sync_wallet_to_customer_order()` /
  `sync_order_attribution_to_customer_order()`, `stamp_order_attribution_from_form()`
  — wallet state machine + attribution mirroring between `form_responses`
  and `customer_orders`.
- `pick_csr_for_order_assignment`, `get_next_round_robin_user`,
  `get_percentage_assigned_user`, `pick_csr_for_follow_up` — CSR assignment.
- `auto_create_follow_up_for_abandoned_cart()` — follow-up auto-creation.
- `resolve_csr_user_id`, `agent_product_on_hand` — helper lookups.
- Three derived views, never migrated (nothing to migrate — recomputed from
  `stock_movements` on read): `agent_stock_v`, `agent_stock_breakdown_v`,
  `v_monthly_delivery_summary`.

RLS policies (every `CREATE POLICY` in `schema_baseline.sql` plus the ones
added by later migrations) are the auth phase's concern
(`requireTenantPermission`/`requireTenantRole` equivalents) — not
enumerated here since that conversion is explicitly out of scope, but the
Products/Orders/Wallet/Abandoned-carts/Follow-ups policies are all
role-conditioned (`Owner`/`Admin`/`Manager`/`Customer Relations`), so that
phase needs `docs/ROLE-MAPPING.md` open alongside the RLS SQL.

## 6. Data migration script

`packages/db/scripts/migrate-numbatrak.ts` (run via `pnpm --filter
@platform/db migrate:numbatrak [-- --dry-run]`).

- Connects read-only to `SOURCE_DATABASE_URL` (`SET
  default_transaction_read_only = on`, confirmed via
  `current_setting()` before any query runs) and read-write to the target
  via `@platform/db`'s existing `getDb()`.
- Migrates all 25 tables in FK dependency order (agents → csr aliases →
  products → variants → offers → price history → forms → form products →
  form responses → **self-referencing `converted_response_id` two-pass
  patch** → form response items → inventory lots → customer orders →
  customer order items → order inventory consumption → stock movements →
  legacy inventory → deliveries → unified expenses → expense subcategories
  → legacy agent expenses → wallet remittance lines → abandoned carts →
  follow-ups → order assignment settings/weights → activities).
- Every insert is `onConflictDoNothing()` keyed on the preserved primary key
  (bigint identity columns use `generatedByDefaultAsIdentity()`, so explicit
  ids can be inserted) — safe to re-run indefinitely.
- `--dry-run` fetches and validates every row, including FK resolution
  against the target DB, but performs zero writes.
- Prints a per-table summary: `fetched` / `inserted` / `skippedNoOrg` /
  `skippedOtherRequiredFk` (by column) / `nulledOptionalFk` (by column) —
  this *is* the live dry-run report; run it with `--dry-run` against a
  staging copy of the real target DB (populated by the auth-migration phase
  first) and read the printed counts before deciding anything is safe to
  apply for real.

### Verification performed in this environment

I do not have credentials for the real Numbatrak Supabase project, so the
script has **not** been run against real production data — that must happen
before cutover. What I did verify, end-to-end, against two disposable local
Postgres databases standing in for source/target (created and dropped in
this session, never touching the shared dev DB or anything real):

- Org-scoping skip logic: a row whose `organization_id` doesn't resolve in
  the target is skipped and counted, not inserted with a dangling FK.
- Required-user-FK skip logic (`numbatrak_csr_name_aliases.user_id`): an
  unresolvable required user reference skips the row and is counted.
- Cross-stage `requireRef`/`optionalRef` (product → product variant) via the
  in-process id sets populated by `afterInsert`.
- Idempotency: re-running the identical migration against already-populated
  tables reports `inserted=0` for every table, with `fetched`/`skipped`
  counts unchanged.
- `--dry-run`: reports the same counts as a real run would, with zero rows
  actually written (verified via row count before/after).
- The `converted_response_id` self-referencing two-pass patch: two
  `form_responses` rows, one referencing the other's not-yet-inserted id,
  patched correctly on the second pass.

### One incidental finding, not mine to fix

While validating the schema against `drizzle-kit generate`/`push` in this
repo's `packages/db`, I found the migration metadata is already
inconsistent independent of anything in this task: `drizzle/meta/` is
missing snapshot files for migrations `0009` through `0015` (despite their
`.sql` files and journal entries existing), and `drizzle/0016_business_metrics.sql`
exists on disk but was never added to `drizzle/meta/_journal.json` (git
blame: both landed in the same commit, `2bb5205`). Together these mean
`drizzle-kit generate` currently computes its diff against a stale baseline
and would silently bundle unrelated tables into any new migration file run
today. I did not attempt to repair this — out of scope for Numbatrak, and
risky to fix blind. **Whoever generates the actual `NNNN_*.sql` migration
file for these new `numbatrak_*` tables should fix this gap first**, or
hand-verify the generated file contains only `numbatrak_*` statements before
applying it.

## 7. Recommended order of operations for a real cutover

1. Fix the `drizzle-kit` snapshot gap (§6) or otherwise obtain a trustworthy
   generated migration for the `numbatrak_*` tables; apply it to the target.
2. Auth migration phase runs first: creates `organization` rows (one per
   Numbatrak org) and `user` rows (one per Numbatrak login), resolving §4's
   two open id-mapping questions concretely.
3. Run `migrate:numbatrak --dry-run` against a staging copy of the real
   target DB, with `ORG_ID_MAP_PATH`/`USER_ID_MAP_PATH` set if needed per
   step 2's outcome. Read the printed diagnostics — anything beyond a small
   number of `nulledOptionalFk`/`skippedOtherRequiredFk` warrants
   investigation before proceeding.
4. Resolve the `docs/ORDER-DATA-FLUSH-STRATEGY.md` audit (test/demo rows,
   duplicate submissions, orphans) against the **source** before migrating,
   per that doc's own procedure — this script does not attempt any of that
   cleanup itself, by design (never mutates the source).
5. Run for real (no `--dry-run`), then re-run once more to confirm the
   idempotency guarantee holds (should report `inserted=0` everywhere).
6. Reconcile `numbatrak_inventory_legacy` / `numbatrak_agent_expenses_legacy`
   against their ledger-based replacements before deciding whether ongoing
   support for both is needed post-cutover.
