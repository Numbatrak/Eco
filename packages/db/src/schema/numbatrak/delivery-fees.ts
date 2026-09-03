// Numbatrak domain: per-location delivery fee rules for Order Forms (spec
// feature 15's "Location on the form can drive the delivery fee, tying to
// the delivery configuration" LOCKED RULE). Net-new - form-submitted orders
// previously always hardcoded deliveryFee to "0" regardless of the
// customer's captured state/region.
import { sql } from "drizzle-orm";
import { index, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization } from "../../auth-schema.js";

export const numbatrakDeliveryFeeRules = pgTable(
  "numbatrak_delivery_fee_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // NULL = the org's default/fallback rule, matched when no state-specific
    // rule applies. Stored lowercased/trimmed; lookups normalize the same way.
    state: text("state"),
    fee: numeric("fee", { precision: 10, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_delivery_fee_rules_org_idx").on(table.organizationId),
    uniqueIndex("numbatrak_delivery_fee_rules_org_default_unique_idx")
      .on(table.organizationId)
      .where(sql`${table.state} IS NULL`),
    uniqueIndex("numbatrak_delivery_fee_rules_org_state_unique_idx")
      .on(table.organizationId, table.state)
      .where(sql`${table.state} IS NOT NULL`),
  ],
);
