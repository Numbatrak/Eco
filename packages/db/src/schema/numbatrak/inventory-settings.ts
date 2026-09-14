import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization } from "../../auth-schema.js";

// One row per org. Fallback used when a product's own low_stock_threshold
// (see products.ts) is null - previously such products were never flagged as
// low stock anywhere (StockGrid.tsx's isLowStock treated null as "no alert").
export const numbatrakInventorySettings = pgTable(
  "numbatrak_inventory_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    defaultLowStockThreshold: integer("default_low_stock_threshold").notNull().default(5),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("numbatrak_inventory_settings_org_unique_idx").on(table.organizationId)],
);
