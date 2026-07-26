// Numbatrak domain: CSR follow-up tasks (abandoned-cart recovery + order
// follow-up). Source `public.follow_ups`, stabilized through
// supabase/migrations/20260720200000_follow_up_stabilization.sql.
import { sql } from "drizzle-orm";
import { bigint, check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "../../auth-schema.js";
import { numbatrakAbandonedCarts } from "./abandoned-carts.js";

export const numbatrakFollowUps = pgTable(
  "numbatrak_follow_ups",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    // Nullable in source (backfilled by a BEFORE INSERT/UPDATE trigger from
    // order_id/abandoned_cart_id when omitted) - preserved as nullable.
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }),
    // ANOMALY (flagged in migration report): source FK targets the legacy
    // `orders` table (never repointed to customer_orders, unlike
    // abandoned_carts.converted_order_id). That table is out of scope for
    // this migration, so this column is carried over as a plain uuid with NO
    // FK - a human must decide whether to repoint it at customer_orders,
    // backfill from data, or drop it. src/services/followUps.ts still queries
    // `orders` directly through this column (order:orders(...) embed) today.
    orderId: uuid("order_id"),
    abandonedCartId: uuid("abandoned_cart_id").references(() => numbatrakAbandonedCarts.id, {
      onDelete: "set null",
    }),
    assignedTo: text("assigned_to").references(() => user.id, { onDelete: "set null" }),
    status: text("status").notNull().default("awaiting"),
    priority: text("priority").notNull().default("medium"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    firstContactAt: timestamp("first_contact_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    responseTimeMinutes: integer("response_time_minutes"),
    resolutionTimeMinutes: integer("resolution_time_minutes"),
    outcome: text("outcome"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_follow_ups_abandoned_cart_id_idx").on(table.abandonedCartId),
    index("numbatrak_follow_ups_assigned_to_idx").on(table.assignedTo),
    index("numbatrak_follow_ups_created_at_idx").on(table.createdAt),
    index("numbatrak_follow_ups_order_id_idx").on(table.orderId),
    index("numbatrak_follow_ups_org_idx").on(table.organizationId),
    index("numbatrak_follow_ups_status_idx").on(table.status),
    check(
      "numbatrak_follow_ups_status_chk",
      sql`${table.status} IN ('awaiting', 'followed_up', 'resolved', 'cancelled')`,
    ),
    check("numbatrak_follow_ups_priority_chk", sql`${table.priority} IN ('low', 'medium', 'high', 'urgent')`),
    check(
      "numbatrak_follow_ups_outcome_chk",
      sql`${table.outcome} IS NULL OR ${table.outcome} IN ('converted', 'not_converted', 'not_interested', 'follow_up_needed', 'resolved', 'other')`,
    ),
  ],
);
