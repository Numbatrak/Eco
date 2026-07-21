// Numbatrak domain: catalog (products, variants, typed offers, price history).
// Source: public.products / product_variants / product_offers / product_price_history,
// stabilized through supabase/migrations/20260720210000_product_stabilization.sql.
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { organization } from "../../auth-schema.js";

export const numbatrakProductTypeEnum = pgEnum("numbatrak_product_type", ["NORMAL", "INCENTIVE"]);

export const numbatrakProductOfferTypeEnum = pgEnum("numbatrak_product_offer_type", [
  "single",
  "quantity_tier",
  "bundle",
  "buy_x_get_y",
]);

export const numbatrakProducts = pgTable(
  "numbatrak_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku"),
    type: numbatrakProductTypeEnum("type").notNull().default("NORMAL"),
    basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
    costPrice: numeric("cost_price", { precision: 10, scale: 2 }).notNull(),
    active: boolean("active").notNull().default(true),
    category: text("category"),
    subBrand: text("sub_brand"),
    allowsVariants: boolean("allows_variants").notNull().default(false),
    allowsBundles: boolean("allows_bundles").notNull().default(false),
    allowsDiscounts: boolean("allows_discounts").notNull().default(false),
    // Alert when agent on-hand falls at or below this qty (null = no alert).
    lowStockThreshold: integer("low_stock_threshold"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("numbatrak_products_org_idx").on(table.organizationId),
    index("numbatrak_products_active_idx").on(table.active),
    index("numbatrak_products_type_idx").on(table.type),
  ],
);

// First-class sellable SKUs under a parent product (own price/cost/stock line).
export const numbatrakProductVariants = pgTable(
  "numbatrak_product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => numbatrakProducts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku"),
    basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull(),
    costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull(),
    active: boolean("active").notNull().default(true),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_product_variants_product_idx").on(table.productId),
    index("numbatrak_product_variants_org_idx").on(table.organizationId),
    check("numbatrak_product_variants_prices_nonneg_chk", sql`${table.basePrice} >= 0 AND ${table.costPrice} >= 0`),
  ],
);

// Typed pricing offers: single / quantity-tier / bundle / buy-X-get-Y - a
// separate axis from variants. `bundleItems` is an opaque JSON list of
// { productId, quantity } lines for `bundle`-type offers (no relational FK
// per line in the source schema - preserved as-is).
export const numbatrakProductOffers = pgTable(
  "numbatrak_product_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => numbatrakProducts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => numbatrakProductVariants.id, { onDelete: "set null" }),
    offerType: numbatrakProductOfferTypeEnum("offer_type").notNull().default("single"),
    label: text("label").notNull(),
    minQuantity: integer("min_quantity").notNull().default(1),
    freeQuantity: integer("free_quantity").notNull().default(0),
    bundleItems: jsonb("bundle_items"),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
    active: boolean("active").notNull().default(true),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_product_offers_product_idx").on(table.productId),
    index("numbatrak_product_offers_org_idx").on(table.organizationId),
    check(
      "numbatrak_product_offers_quantities_nonneg_chk",
      sql`${table.minQuantity} > 0 AND ${table.freeQuantity} >= 0`,
    ),
    check("numbatrak_product_offers_prices_nonneg_chk", sql`${table.price} >= 0 AND ${table.unitCost} >= 0`),
  ],
);

// Point-in-time price/cost snapshots. `endsAt IS NULL` marks the currently
// active row; order intake reads the latest open-ended row per product.
export const numbatrakProductPriceHistory = pgTable(
  "numbatrak_product_price_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => numbatrakProducts.id, { onDelete: "cascade" }),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    costPrice: numeric("cost_price", { precision: 10, scale: 2 }).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("numbatrak_product_price_history_product_idx").on(table.productId),
    // Plain (non-unique) index in source - multiple open-ended rows per
    // product are not prevented at the DB layer, preserved as-is.
    index("numbatrak_product_price_history_active_idx")
      .on(table.productId, table.endsAt)
      .where(sql`${table.endsAt} IS NULL`),
  ],
);
