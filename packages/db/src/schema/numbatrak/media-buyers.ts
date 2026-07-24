import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "../../auth-schema.js";

export const numbatrakMediaBuyerSettings = pgTable(
  "numbatrak_media_buyer_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    weeklyReviewEnabled: boolean("weekly_review_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("numbatrak_media_buyer_settings_org_unique_idx").on(table.organizationId),
  ],
);

export const numbatrakContractors = pgTable(
  "numbatrak_contractors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").notNull(),
    rate: numeric("rate", { precision: 12, scale: 2 }).notNull().default("0"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_contractors_org_idx").on(table.organizationId),
    check(
      "numbatrak_contractors_role_chk",
      sql`${table.role} IN ('vo_artist', 'video_editor')`,
    ),
  ],
);

export const numbatrakProductionBatches = pgTable(
  "numbatrak_production_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    buyerId: text("buyer_id").references(() => user.id, { onDelete: "set null" }),
    brand: text("brand"),
    productId: text("product_id"),
    creativeType: text("creative_type").notNull(),
    description: text("description"),
    voArtistId: uuid("vo_artist_id").references(() => numbatrakContractors.id, { onDelete: "set null" }),
    editorId: uuid("editor_id").references(() => numbatrakContractors.id, { onDelete: "set null" }),
    videoCount: integer("video_count").notNull().default(1),
    status: text("status").notNull().default("briefed"),
    driveLink: text("drive_link"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_production_batches_org_idx").on(table.organizationId),
    check(
      "numbatrak_production_batches_creative_type_chk",
      sql`${table.creativeType} IN ('voiceover', 'ugc', 'ai_story', 'sound', 'other')`,
    ),
    check(
      "numbatrak_production_batches_status_chk",
      sql`${table.status} IN ('briefed', 'shooting', 'editing', 'done')`,
    ),
  ],
);

export const numbatrakContractorPayments = pgTable(
  "numbatrak_contractor_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contractorId: uuid("contractor_id")
      .notNull()
      .references(() => numbatrakContractors.id, { onDelete: "cascade" }),
    pieces: integer("pieces").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    brand: text("brand"),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_contractor_payments_org_idx").on(table.organizationId),
    index("numbatrak_contractor_payments_contractor_idx").on(table.contractorId),
  ],
);

export const numbatrakAdCatalog = pgTable(
  "numbatrak_ad_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    batchId: uuid("batch_id").references(() => numbatrakProductionBatches.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    hookType: text("hook_type"),
    creativeType: text("creative_type"),
    brand: text("brand"),
    productId: text("product_id"),
    offerId: text("offer_id"),
    driveLink: text("drive_link"),
    editorId: uuid("editor_id").references(() => numbatrakContractors.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_ad_catalog_org_idx").on(table.organizationId),
    index("numbatrak_ad_catalog_batch_idx").on(table.batchId),
  ],
);

export const numbatrakAdSpend = pgTable(
  "numbatrak_ad_spend",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    buyerId: text("buyer_id").references(() => user.id, { onDelete: "set null" }),
    spendDate: date("spend_date").notNull(),
    brand: text("brand"),
    productId: text("product_id"),
    offerId: text("offer_id"),
    platform: text("platform"),
    spend: numeric("spend", { precision: 14, scale: 2 }).notNull().default("0"),
    orders: integer("orders").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_ad_spend_org_idx").on(table.organizationId),
    index("numbatrak_ad_spend_date_idx").on(table.spendDate),
    index("numbatrak_ad_spend_buyer_idx").on(table.buyerId),
  ],
);

export const numbatrakCpaTargets = pgTable(
  "numbatrak_cpa_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    buyerId: text("buyer_id").references(() => user.id, { onDelete: "set null" }),
    brand: text("brand"),
    productId: text("product_id"),
    offerId: text("offer_id"),
    cpaTarget: numeric("cpa_target", { precision: 12, scale: 2 }).notNull().default("0"),
    weeklyBudget: numeric("weekly_budget", { precision: 14, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_cpa_targets_org_idx").on(table.organizationId),
    index("numbatrak_cpa_targets_buyer_idx").on(table.buyerId),
  ],
);

export const numbatrakWeeklyReviews = pgTable(
  "numbatrak_weekly_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    adsToScale: text("ads_to_scale"),
    adsToPause: text("ads_to_pause"),
    adsToKill: text("ads_to_kill"),
    biggestWin: text("biggest_win"),
    biggestIssue: text("biggest_issue"),
    verdict: text("verdict").notNull().default("on_track"),
    nextWeekDecisions: text("next_week_decisions"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_weekly_reviews_org_idx").on(table.organizationId),
    index("numbatrak_weekly_reviews_buyer_idx").on(table.buyerId),
    check(
      "numbatrak_weekly_reviews_verdict_chk",
      sql`${table.verdict} IN ('on_track', 'needs_attention', 'critical')`,
    ),
  ],
);
