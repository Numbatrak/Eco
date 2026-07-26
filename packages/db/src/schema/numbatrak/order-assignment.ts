// Numbatrak domain: CSR auto-assignment for new orders (round-robin or
// weighted percentage). Source `public.order_assignment_settings` /
// `order_assignment_weights`, stabilized through
// supabase/migrations/20260720230000_order_assignment_stabilization.sql.
import { sql } from "drizzle-orm";
import { boolean, check, index, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "../../auth-schema.js";

export const numbatrakOrderAssignmentSettings = pgTable(
  "numbatrak_order_assignment_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" })
      .unique(),
    assignmentMethod: text("assignment_method").notNull().default("round_robin"),
    lastAssignedUserId: text("last_assigned_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("numbatrak_order_assignment_settings_org_idx").on(table.organizationId),
    check(
      "numbatrak_order_assignment_settings_method_chk",
      sql`${table.assignmentMethod} IN ('round_robin', 'percentage')`,
    ),
  ],
);

export const numbatrakOrderAssignmentWeights = pgTable(
  "numbatrak_order_assignment_weights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull().default("0"),
    isPaused: boolean("is_paused").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("numbatrak_order_assignment_weights_org_idx").on(table.organizationId),
    uniqueIndex("numbatrak_order_assignment_weights_org_user_unique_idx").on(table.organizationId, table.userId),
  ],
);
