// Numbatrak domain: order-intake forms and their attached products.
// Source: public.forms / form_products.
//
// Excluded from this schema (see migration report): public.form_incentives
// and public.field_mappings - both exist in schema_baseline.sql but have zero
// references anywhere in src/ (grep-verified); they appear to be dead/orphaned
// tables from an earlier design. Not carried forward pending human confirmation.
import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization } from "../../auth-schema.js";
import { numbatrakProducts } from "./products.js";

export const numbatrakForms = pgTable(
  "numbatrak_forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    formToken: text("form_token").notNull(),
    // Form builder definition: fields, conditional logic, confirmation config.
    schema: jsonb("schema").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    siteUrl: text("site_url"),
    fieldMapping: jsonb("field_mapping").default({}),
    // Optional sub-brand tag; copied onto orders for filtering and roll-ups.
    subBrand: text("sub_brand"),
    // Optional funnel display name; when null the app uses `name`.
    funnelName: text("funnel_name"),
  },
  (table) => [
    uniqueIndex("numbatrak_forms_token_unique_idx").on(table.formToken),
    index("numbatrak_forms_org_idx").on(table.organizationId),
    index("numbatrak_forms_active_idx").on(table.active),
    index("numbatrak_forms_token_idx").on(table.formToken),
  ],
);

export const numbatrakFormProducts = pgTable(
  "numbatrak_form_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
      .notNull()
      .references(() => numbatrakForms.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => numbatrakProducts.id, { onDelete: "cascade" }),
    minQuantity: integer("min_quantity").default(1),
    maxQuantity: integer("max_quantity"),
    required: boolean("required").default(false),
    // Source CHECK: pricing_mode IN ('fixed', 'selectable').
    pricingMode: text("pricing_mode").notNull().default("fixed"),
    displayOrder: integer("display_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("numbatrak_form_products_form_product_unique_idx").on(table.formId, table.productId),
    index("numbatrak_form_products_form_idx").on(table.formId),
    index("numbatrak_form_products_product_idx").on(table.productId),
    check("numbatrak_form_products_pricing_mode_chk", sql`${table.pricingMode} IN ('fixed', 'selectable')`),
  ],
);
