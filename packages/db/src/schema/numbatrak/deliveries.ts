// Numbatrak domain: the "Waybills" feature (route /waybills, backed by
// `DeliveriesForm` per docs/PHASE-CURRENT-STABILIZATION.md §5). Source table
// is `public.deliveries` - logistics status (Waybilled/Delivered) tracking
// stock movement into/out of an agent's holding, distinct from an order's own
// delivery status.
//
// Excluded from this schema (see migration report): `public.waybills` (a
// separate table with its own bigint id, `waybill_number`, `eta`,
// `dispatched_at`/`delivered_at`, status on-time/at-risk/delayed/...) and
// `public.monthly_summary`. Both exist in schema_baseline.sql but are never
// queried anywhere in src/ (grep-verified) and are not mentioned in the
// current feature docs - they read as orphaned tables from an earlier design
// draft. Not carried forward pending human confirmation.
import { sql } from "drizzle-orm";
import { bigint, check, index, numeric, pgTable, text, timestamp, uuid, date, integer } from "drizzle-orm/pg-core";

import { organization } from "../../auth-schema.js";
import { numbatrakAgents } from "./agents.js";

export const numbatrakDeliveries = pgTable(
  "numbatrak_deliveries",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    // Free-text CSR name (predates csr_id FKs elsewhere) - resolved via
    // resolve_csr_user_id()/csr_name_aliases at import time, not a live FK.
    csr: text("csr"),
    agentId: bigint("agent_id", { mode: "number" }).references(() => numbatrakAgents.id, { onDelete: "set null" }),
    status: text("status").notNull(),
    // ANOMALY (flagged in migration report): `bigint` in source with NO FK to
    // numbatrak_products.id (uuid) - app's own type comment calls this out:
    // "legacy int or UUID depending on deployment". Preserved verbatim.
    productId: bigint("product_id", { mode: "number" }).notNull(),
    quantity: integer("quantity").notNull(),
    cost: numeric("cost", { precision: 14, scale: 2 }).notNull(),
    waybillingFee: numeric("waybilling_fee", { precision: 14, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Stabilization additions (migration 20260720160000)
    subBrand: text("sub_brand"),
    waybillBatchId: uuid("waybill_batch_id"),
  },
  (table) => [
    index("numbatrak_deliveries_agent_idx").on(table.agentId),
    index("numbatrak_deliveries_date_idx").on(table.date),
    index("numbatrak_deliveries_org_idx").on(table.organizationId),
    index("numbatrak_deliveries_status_idx").on(table.status),
    index("numbatrak_deliveries_sub_brand_idx")
      .on(table.organizationId, table.subBrand)
      .where(sql`${table.subBrand} IS NOT NULL`),
    index("numbatrak_deliveries_waybill_batch_idx")
      .on(table.organizationId, table.waybillBatchId)
      .where(sql`${table.waybillBatchId} IS NOT NULL`),
    check("numbatrak_deliveries_status_chk", sql`${table.status} IN ('Waybilled', 'Delivered')`),
    check("numbatrak_deliveries_quantity_chk", sql`${table.quantity} > 0`),
    check("numbatrak_deliveries_cost_chk", sql`${table.cost} >= 0`),
    check("numbatrak_deliveries_waybilling_fee_chk", sql`${table.waybillingFee} >= 0`),
  ],
);
