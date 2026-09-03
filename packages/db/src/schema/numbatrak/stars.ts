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
    // How the Leaderboard ranks staff - settable per business (spec: "by star
    // tier, by revenue, by delivery rate, and so on"). by_tier reads
    // numbatrakStars' latest award per staff; the others pull from Orders,
    // the same source Payroll's commission/delivery-rate calc already reads.
    leaderboardStyle: text("leaderboard_style").notNull().default("by_tier"),
    sotmEnabled: boolean("sotm_enabled").notNull().default(false),
    sotmCriteria: text("sotm_criteria").notNull().default("manual"),
    sotmMinStarTier: integer("sotm_min_star_tier").notNull().default(0),
    // Whether an active (uncleared) strike disqualifies someone from SOTM
    // this month - settable per spec's SOTM eligibility rule.
    sotmStrikeDisqualifies: boolean("sotm_strike_disqualifies").notNull().default(false),
    sotmWinnerCount: integer("sotm_winner_count").notNull().default(1),
    // Flows into Payroll's calculatedSotmBonus when a winner is confirmed -
    // the Stars module's own source of truth for "how much," rather than
    // Payroll operators re-entering it per pay structure.
    sotmPrizeAmount: numeric("sotm_prize_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("numbatrak_star_settings_org_unique_idx").on(table.organizationId),
    check(
      "numbatrak_star_settings_sotm_criteria_chk",
      sql`${table.sotmCriteria} IN ('manual', 'highest_delivery', 'highest_delivery_rate', 'highest_revenue', 'highest_revenue_per_order', 'highest_star_tier', 'most_upsells')`,
    ),
    check(
      "numbatrak_star_settings_leaderboard_style_chk",
      sql`${table.leaderboardStyle} IN ('by_tier', 'by_revenue', 'by_delivery_rate', 'by_upsells')`,
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
    // What earns this tier - a business-defined, free-text criterion (spec:
    // "a business defines the criteria worthy of a star, and heads award
    // them manually" - not a computed/enforced rule, just documentation
    // shown to whoever is deciding).
    criteria: text("criteria"),
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
    // Which tier this award set the person to. "Stars are TIERS a person
    // holds, not a running tally" (LOCKED RULE) - a person's CURRENT tier is
    // derived as their most recent award's tierId, not a sum of `points`.
    // `points`/`month` below predate this and are kept only for the
    // pre-existing rows' sake; new awards don't rely on them for tier state.
    tierId: uuid("tier_id").references(() => numbatrakStarTiers.id, { onDelete: "set null" }),
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
    index("numbatrak_stars_staff_awarded_idx").on(table.staffId, table.awardedAt),
  ],
);
