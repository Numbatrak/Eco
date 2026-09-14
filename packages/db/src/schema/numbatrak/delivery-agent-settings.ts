import { numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization } from "../../auth-schema.js";

// One row per org. Fallback used when an agent's own deliveryFeeOverride
// (see agents.ts) is null. Distinct from numbatrakDeliveryFeeRules
// (delivery-fees.ts), which drives what a *customer* is charged for delivery
// by location - this is what an *agent* earns per order they deliver, before
// any per-agent override. Not yet consumed by the remittance calculation
// (numbatrak-wallet/lib/wallet.ts still sums the order's own deliveryFee) -
// wiring this in is a deliberate follow-up product decision, not done here.
export const numbatrakDeliveryAgentSettings = pgTable(
  "numbatrak_delivery_agent_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    defaultAgentDeliveryFee: numeric("default_agent_delivery_fee", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("numbatrak_delivery_agent_settings_org_unique_idx").on(table.organizationId)],
);
