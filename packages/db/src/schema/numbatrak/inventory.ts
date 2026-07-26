// Numbatrak domain: inventory ledger (current path) + legacy per-agent totals.
//
// Two coexisting models per docs/PHASE-CURRENT-STABILIZATION.md cross-cutting
// item C8 ("Dual inventory model... Ledger tab default; deprecation banner on
// legacy totals tab" - NOT fully retired): `stock_movements` + `inventory_lots`
// is the FIFO ledger the app defaults to; `numbatrakInventoryLegacy` (source
// table `public.inventory`, a flat per-agent/product quantity) is still
// actively read AND written by src/services/inventory.ts today, so it is
// migrated here too rather than dropped, pending a human reconciliation
// decision (see migration report - the two models are not guaranteed to
// agree, and `inventory` was force-emptied at least once historically by
// scripts/migrations/007_inventory_product_id_uuid.sql).
import { sql } from "drizzle-orm";
import { bigint, check, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "../../auth-schema.js";
import { numbatrakAgents } from "./agents.js";
import { numbatrakCustomerOrders } from "./orders.js";
import { numbatrakProducts, numbatrakProductVariants } from "./products.js";

export const numbatrakInventoryLots = pgTable(
  "numbatrak_inventory_lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => numbatrakProducts.id, { onDelete: "restrict" }),
    quantityRemaining: integer("quantity_remaining").notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    // Optional variant scoping (migration 20260720210000).
    variantId: uuid("variant_id").references(() => numbatrakProductVariants.id, { onDelete: "set null" }),
  },
  (table) => [
    index("numbatrak_inventory_lots_org_idx").on(table.organizationId),
    index("numbatrak_inventory_lots_product_idx").on(table.productId),
    index("numbatrak_inventory_lots_received_at_idx").on(table.organizationId, table.productId, table.receivedAt),
    check("numbatrak_inventory_lots_qty_remaining_chk", sql`${table.quantityRemaining} >= 0`),
  ],
);

export const numbatrakStockMovements = pgTable(
  "numbatrak_stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Source CHECK: waybill_to_agent | deliver_to_customer | return_to_lagos |
    // transfer | adjust | damaged | missing (damaged/missing added 20260720140000).
    movementType: text("movement_type").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => numbatrakProducts.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    fromAgentId: bigint("from_agent_id", { mode: "number" }).references(() => numbatrakAgents.id, {
      onDelete: "set null",
    }),
    toAgentId: bigint("to_agent_id", { mode: "number" }).references(() => numbatrakAgents.id, {
      onDelete: "set null",
    }),
    orderId: uuid("order_id").references(() => numbatrakCustomerOrders.id, { onDelete: "set null" }),
    // Groups rows posted in one bulk waybill batch - opaque id, no FK in source.
    waybillBatchId: uuid("waybill_batch_id"),
    // Soft link back to the legacy `deliveries` row this movement was
    // generated from, if any - no FK in source (deliveries.id is bigint,
    // matches this column's type, but the constraint was never added).
    legacyDeliveryId: bigint("legacy_delivery_id", { mode: "number" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    cost: numeric("cost", { precision: 14, scale: 2 }).default("0"),
    fee: numeric("fee", { precision: 14, scale: 2 }).default("0"),
    recordedByUserId: text("recorded_by_user_id").references(() => user.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("numbatrak_stock_movements_batch_idx")
      .on(table.waybillBatchId)
      .where(sql`${table.waybillBatchId} IS NOT NULL`),
    index("numbatrak_stock_movements_from_idx").on(table.fromAgentId),
    index("numbatrak_stock_movements_org_idx").on(table.organizationId),
    index("numbatrak_stock_movements_product_idx").on(table.organizationId, table.productId, table.occurredAt),
    index("numbatrak_stock_movements_to_idx").on(table.toAgentId),
    uniqueIndex("numbatrak_stock_movements_legacy_delivery_unique_idx")
      .on(table.legacyDeliveryId)
      .where(sql`${table.legacyDeliveryId} IS NOT NULL`),
    check(
      "numbatrak_stock_movements_movement_type_chk",
      sql`${table.movementType} IN ('waybill_to_agent', 'deliver_to_customer', 'return_to_lagos', 'transfer', 'adjust', 'damaged', 'missing')`,
    ),
    check(
      "numbatrak_stock_movements_agents_chk",
      sql`(${table.movementType} = 'waybill_to_agent' AND ${table.toAgentId} IS NOT NULL)
        OR (${table.movementType} = 'deliver_to_customer' AND ${table.fromAgentId} IS NOT NULL)
        OR (${table.movementType} = 'return_to_lagos' AND ${table.fromAgentId} IS NOT NULL)
        OR (${table.movementType} = 'transfer' AND ${table.fromAgentId} IS NOT NULL AND ${table.toAgentId} IS NOT NULL)
        OR (${table.movementType} = 'adjust' AND (${table.fromAgentId} IS NOT NULL OR ${table.toAgentId} IS NOT NULL))
        OR (${table.movementType} IN ('damaged', 'missing') AND ${table.fromAgentId} IS NOT NULL)`,
    ),
  ],
);

// Legacy per-agent/product running totals - see file header. Deprecated by
// the app's own UI/docs but still live-written; migrated as-is, unreconciled.
export const numbatrakInventoryLegacy = pgTable(
  "numbatrak_inventory_legacy",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    agentId: bigint("agent_id", { mode: "number" }).references(() => numbatrakAgents.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => numbatrakProducts.id, { onDelete: "restrict" }),
    totalQuantity: integer("total_quantity").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("numbatrak_inventory_legacy_agent_product_org_unique_idx").on(
      table.agentId,
      table.productId,
      table.organizationId,
    ),
    index("numbatrak_inventory_legacy_agent_idx").on(table.agentId),
    index("numbatrak_inventory_legacy_org_idx").on(table.organizationId),
    index("numbatrak_inventory_legacy_product_idx").on(table.productId),
    check("numbatrak_inventory_legacy_total_quantity_chk", sql`${table.totalQuantity} >= 0`),
  ],
);
