import { sql } from "drizzle-orm";
import { boolean, check, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "../../auth-schema.js";
import { numbatrakStaff } from "./staff.js";

export const numbatrakStarSettings = pgTable(
  "numbatrak_star_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    sotmEnabled: boolean("sotm_enabled").notNull().default(false),
    sotmCriteria: text("sotm_criteria").notNull().default("manual"),
    sotmMinStarTier: integer("sotm_min_star_tier").notNull().default(0),
    sotmWinnerCount: integer("sotm_winner_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("numbatrak_star_settings_org_unique_idx").on(table.organizationId),
    check(
      "numbatrak_star_settings_sotm_criteria_chk",
      sql`${table.sotmCriteria} IN ('manual', 'highest_delivery', 'highest_delivery_rate', 'highest_revenue', 'highest_revenue_per_order', 'highest_star_tier', 'most_upsells')`,
    ),
  ],
);

export const numbatrakStarTiers = pgTable(
  "numbatrak_star_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    minPoints: integer("min_points").notNull().default(0),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_star_tiers_org_idx").on(table.organizationId),
    uniqueIndex("numbatrak_star_tiers_org_name_unique_idx").on(table.organizationId, table.name),
  ],
);

export const numbatrakStars = pgTable(
  "numbatrak_stars",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => numbatrakStaff.id, { onDelete: "cascade" }),
    points: integer("points").notNull().default(1),
    reason: text("reason").notNull(),
    awardedBy: text("awarded_by").references(() => user.id, { onDelete: "set null" }),
    awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
    month: text("month").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_stars_org_idx").on(table.organizationId),
    index("numbatrak_stars_staff_idx").on(table.staffId),
    index("numbatrak_stars_month_idx").on(table.month),
  ],
);
