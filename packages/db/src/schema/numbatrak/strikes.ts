import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "../../auth-schema.js";
import { numbatrakStaff } from "./staff.js";

export const numbatrakStrikeSettings = pgTable(
  "numbatrak_strike_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    threshold: integer("threshold").notNull().default(2),
    thresholdPeriod: text("threshold_period").notNull().default("month"),
    consequence: text("consequence").notNull().default("HR review"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("numbatrak_strike_settings_org_unique_idx").on(table.organizationId),
  ],
);

export const numbatrakStrikes = pgTable(
  "numbatrak_strikes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => numbatrakStaff.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    issuedBy: text("issued_by").references(() => user.id, { onDelete: "set null" }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    cleared: boolean("cleared").notNull().default(false),
    clearedBy: text("cleared_by").references(() => user.id, { onDelete: "set null" }),
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_strikes_org_idx").on(table.organizationId),
    index("numbatrak_strikes_staff_idx").on(table.staffId),
    index("numbatrak_strikes_issued_at_idx").on(table.issuedAt),
  ],
);
