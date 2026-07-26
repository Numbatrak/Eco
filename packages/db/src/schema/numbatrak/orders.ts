// Numbatrak domain: order intake and the order pipeline.
//
// IMPORTANT - two order tables, both current-path (per docs/PHASE-CURRENT-STABILIZATION.md
// cross-cutting item C1): `form_responses` is the original intake table (FIFO
// inventory consumption in order_inventory_consumption FKs to it, not to
// customer_orders) and `customer_orders` is a newer normalized 1:1 projection
// used by the Orders UI. orderDataSource.ts in the source app merges both at
// query time because not every historical form_responses row has been
// projected into customer_orders yet. Do not treat form_responses as legacy -
// it is still being written to today.
//
// Explicitly NOT migrated here (see migration report): the older bare
// `orders` / `order_items` tables (distinct from customer_orders /
// customer_order_items) - per task scope these are legacy and superseded.
// NOTE: src/services/followUps.ts still queries `orders` directly
// (order:orders(...) embed) for a follow-up's source order anchor date, and
// follow_ups.order_id's FK in the source DB targets that same legacy `orders`
// table (never repointed to customer_orders, unlike
// abandoned_carts.converted_order_id which was explicitly repointed by
// migration 20260720190000). See follow-ups.ts for how this was handled.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { organization, user } from "../../auth-schema.js";
import { numbatrakAgents } from "./agents.js";
import { numbatrakForms } from "./forms.js";
import { numbatrakInventoryLots } from "./inventory.js";
import { numbatrakProductOffers, numbatrakProducts, numbatrakProductVariants } from "./products.js";

// ---------------------------------------------------------------------------
// form_responses - primary order + abandoned-cart intake table
// ---------------------------------------------------------------------------

export const numbatrakFormResponses = pgTable(
  "numbatrak_form_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    formId: uuid("form_id").references(() => numbatrakForms.id, { onDelete: "set null" }),
    responseType: text("response_type").notNull().default("order"),
    status: text("status").notNull().default("pending"),
    source: text("source").notNull().default("wordpress"),
    pageUrl: text("page_url"),
    fieldValues: jsonb("field_values").notNull().default({}),
    selectedProducts: jsonb("selected_products").default([]),
    phoneNumber: text("phone_number"),
    packageName: text("package_name"),
    customerName: text("customer_name"),
    profit: numeric("profit", { precision: 10, scale: 2 }).default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    convertedFromAbandoned: boolean("converted_from_abandoned").default(false),
    convertedResponseId: uuid("converted_response_id"),
    rawPayload: jsonb("raw_payload").default({}),
    normalizedPayload: jsonb("normalized_payload").default({}),
    items: jsonb("items").default([]),
    package: text("package"),
    offerName: text("offer_name"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow(),
    submissionStatus: text("submission_status"),
    orderCost: numeric("order_cost", { precision: 12, scale: 2 }),
    orderRevenue: numeric("order_revenue", { precision: 12, scale: 2 }),
    orderProfit: numeric("order_profit", { precision: 12, scale: 2 }),
    notes: text("notes"),
    deliveryFee: numeric("delivery_fee", { precision: 12, scale: 2 }),
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }),
    // ANOMALY (flagged in migration report): source column is typed `uuid`,
    // but app code (services/formResponses.ts, orderIntake.ts) reads it as
    // `Number(row.agent_id)` - i.e. the app expects a bigint matching
    // numbatrak_agents.id, not a uuid. No FK exists in source either way.
    // Preserved verbatim (uuid, no FK) pending a live-data check.
    agentId: uuid("agent_id"),
    csrId: text("csr_id").references(() => user.id, { onDelete: "set null" }),
    // Wallet / remittance (migration 20260629150000)
    paymentMethod: text("payment_method").notNull().default("cod"),
    walletStatus: text("wallet_status"),
    remittanceConfirmedAt: timestamp("remittance_confirmed_at", { withTimezone: true }),
    remittanceConfirmedBy: text("remittance_confirmed_by").references(() => user.id, { onDelete: "set null" }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedBy: text("released_by").references(() => user.id, { onDelete: "set null" }),
    // Cross-cutting attribution (migration 20260720120000)
    funnelName: text("funnel_name"),
    subBrand: text("sub_brand"),
    moneyReceivedBy: text("money_received_by").default("agent_collected"),
  },
  (table) => [
    index("numbatrak_form_responses_completed_at_idx").on(table.completedAt),
    index("numbatrak_form_responses_created_at_idx").on(table.createdAt),
    index("numbatrak_form_responses_csr_idx")
      .on(table.organizationId, table.csrId)
      .where(sql`${table.csrId} IS NOT NULL`),
    index("numbatrak_form_responses_field_values_gin_idx").using("gin", table.fieldValues),
    index("numbatrak_form_responses_form_id_idx").on(table.formId),
    index("numbatrak_form_responses_org_idx").on(table.organizationId),
    index("numbatrak_form_responses_package_name_idx").on(table.packageName),
    index("numbatrak_form_responses_phone_number_idx").on(table.phoneNumber),
    // NOTE: predicate is the literal 'completed' from the original migration
    // and was never updated when the status pipeline grew a separate
    // 'delivered' terminal status (is_order_delivered_status() treats both as
    // delivered). May now under-cover 'delivered' rows - flagged in report.
    index("numbatrak_form_responses_profit_completed_idx")
      .on(table.organizationId, table.status)
      .where(sql`${table.status} = 'completed'`),
    index("numbatrak_form_responses_raw_payload_gin_idx").using("gin", table.rawPayload),
    index("numbatrak_form_responses_response_type_idx").on(table.responseType),
    index("numbatrak_form_responses_status_idx").on(table.status),
    index("numbatrak_form_responses_submission_status_idx").on(table.submissionStatus),
    index("numbatrak_form_responses_wallet_idx")
      .on(table.organizationId, table.walletStatus)
      .where(sql`${table.status} = 'completed' AND ${table.responseType} = 'order'`),
    check(
      "numbatrak_form_responses_response_type_chk",
      sql`${table.responseType} IN ('order', 'abandoned_cart')`,
    ),
    check(
      "numbatrak_form_responses_status_chk",
      sql`${table.status} IN ('new', 'confirmed', 'packed', 'dispatched', 'delivered', 'failed', 'returned', 'lost', 'pending', 'completed', 'cancelled', 'abandoned')`,
    ),
    check("numbatrak_form_responses_payment_method_chk", sql`${table.paymentMethod} IN ('cod', 'online')`),
    check(
      "numbatrak_form_responses_wallet_status_chk",
      sql`${table.walletStatus} IS NULL OR ${table.walletStatus} IN ('pending_remittance', 'collected', 'released')`,
    ),
    check(
      "numbatrak_form_responses_money_received_by_chk",
      sql`${table.moneyReceivedBy} IN ('agent_collected', 'company_account', 'prepaid')`,
    ),
  ],
);

export const numbatrakFormResponseItems = pgTable(
  "numbatrak_form_response_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formResponseId: uuid("form_response_id")
      .notNull()
      .references(() => numbatrakFormResponses.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => numbatrakProducts.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPriceAtSubmission: numeric("unit_price_at_submission", { precision: 10, scale: 2 }).notNull(),
    unitCostAtSubmission: numeric("unit_cost_at_submission", { precision: 10, scale: 2 }).notNull(),
    totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
    totalCost: numeric("total_cost", { precision: 10, scale: 2 }).notNull(),
    profit: numeric("profit", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    // Accord rule additions (migration 20260720210000)
    variantId: uuid("variant_id").references(() => numbatrakProductVariants.id, { onDelete: "set null" }),
    offerId: uuid("offer_id").references(() => numbatrakProductOffers.id, { onDelete: "set null" }),
    quantityPaid: integer("quantity_paid"),
    freeQuantity: integer("free_quantity").notNull().default(0),
    trueUnitCount: integer("true_unit_count"),
  },
  (table) => [
    index("numbatrak_form_response_items_product_id_idx").on(table.productId),
    index("numbatrak_form_response_items_response_id_idx").on(table.formResponseId),
    check("numbatrak_form_response_items_profit_chk", sql`${table.profit} = ${table.totalPrice} - ${table.totalCost}`),
    check(
      "numbatrak_form_response_items_total_cost_chk",
      sql`${table.totalCost} = COALESCE(${table.trueUnitCount}, ${table.quantity}) * ${table.unitCostAtSubmission}`,
    ),
    check(
      "numbatrak_form_response_items_total_price_chk",
      sql`${table.totalPrice} = COALESCE(${table.quantityPaid}, ${table.quantity}) * ${table.unitPriceAtSubmission}`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// customer_orders - normalized greenfield projection, backs the Orders UI
// ---------------------------------------------------------------------------

export const numbatrakCustomerOrders = pgTable(
  "numbatrak_customer_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    formResponseId: uuid("form_response_id")
      .references(() => numbatrakFormResponses.id, { onDelete: "set null" })
      .unique(),
    formId: uuid("form_id").references(() => numbatrakForms.id, { onDelete: "set null" }),
    csrId: text("csr_id").references(() => user.id, { onDelete: "set null" }),
    agentId: integer("agent_id").references(() => numbatrakAgents.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"),
    source: text("source").notNull().default("form"),
    customerName: text("customer_name"),
    phoneNumber: text("phone_number"),
    state: text("state"),
    deliveryAddress: text("delivery_address"),
    orderRevenue: numeric("order_revenue", { precision: 14, scale: 2 }),
    orderCost: numeric("order_cost", { precision: 14, scale: 2 }),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }),
    deliveryFee: numeric("delivery_fee", { precision: 14, scale: 2 }),
    profit: numeric("profit", { precision: 14, scale: 2 }),
    notes: text("notes"),
    // ANOMALY (flagged in migration report): declared `text` in source with no
    // FK, even though it holds an abandoned_carts.id (uuid) value - a soft
    // reference only. Preserved verbatim rather than "fixed" into a real FK.
    abandonedCartId: text("abandoned_cart_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Wallet / remittance
    paymentMethod: text("payment_method").notNull().default("cod"),
    walletStatus: text("wallet_status"),
    remittanceConfirmedAt: timestamp("remittance_confirmed_at", { withTimezone: true }),
    remittanceConfirmedBy: text("remittance_confirmed_by").references(() => user.id, { onDelete: "set null" }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedBy: text("released_by").references(() => user.id, { onDelete: "set null" }),
    // Cross-cutting attribution
    offerName: text("offer_name"),
    funnelName: text("funnel_name"),
    subBrand: text("sub_brand"),
    moneyReceivedBy: text("money_received_by").default("agent_collected"),
  },
  (table) => [
    index("numbatrak_customer_orders_agent_idx").on(table.agentId),
    index("numbatrak_customer_orders_created_idx").on(table.organizationId, table.createdAt),
    index("numbatrak_customer_orders_csr_idx").on(table.csrId),
    index("numbatrak_customer_orders_form_idx").on(table.formId),
    index("numbatrak_customer_orders_form_response_idx").on(table.formResponseId),
    index("numbatrak_customer_orders_org_idx").on(table.organizationId),
    index("numbatrak_customer_orders_status_idx").on(table.organizationId, table.status),
    index("numbatrak_customer_orders_sub_brand_idx")
      .on(table.organizationId, table.subBrand)
      .where(sql`${table.subBrand} IS NOT NULL`),
    index("numbatrak_customer_orders_funnel_idx")
      .on(table.organizationId, table.funnelName)
      .where(sql`${table.funnelName} IS NOT NULL`),
    index("numbatrak_customer_orders_offer_idx")
      .on(table.organizationId, table.offerName)
      .where(sql`${table.offerName} IS NOT NULL`),
    // Predicate mirrors is_order_delivered_status(status) - kept in sync by
    // the source migration that dropped+recreated this specific index.
    index("numbatrak_customer_orders_money_received_idx")
      .on(table.organizationId, table.moneyReceivedBy)
      .where(sql`${table.status} IN ('completed', 'delivered')`),
    // NOTE: unlike the index above, this one was never updated to the
    // is_order_delivered_status() predicate - still literal 'completed'.
    index("numbatrak_customer_orders_wallet_idx")
      .on(table.organizationId, table.walletStatus)
      .where(sql`${table.status} = 'completed'`),
    check(
      "numbatrak_customer_orders_status_chk",
      sql`${table.status} IN ('new', 'confirmed', 'packed', 'dispatched', 'delivered', 'failed', 'returned', 'lost', 'pending', 'completed', 'cancelled')`,
    ),
    check(
      "numbatrak_customer_orders_source_chk",
      sql`${table.source} IN ('form', 'manual', 'converted_from_cart')`,
    ),
    check("numbatrak_customer_orders_payment_method_chk", sql`${table.paymentMethod} IN ('cod', 'online')`),
    check(
      "numbatrak_customer_orders_wallet_status_chk",
      sql`${table.walletStatus} IS NULL OR ${table.walletStatus} IN ('pending_remittance', 'collected', 'released')`,
    ),
    check(
      "numbatrak_customer_orders_money_received_by_chk",
      sql`${table.moneyReceivedBy} IN ('agent_collected', 'company_account', 'prepaid')`,
    ),
  ],
);

export const numbatrakCustomerOrderItems = pgTable(
  "numbatrak_customer_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => numbatrakCustomerOrders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => numbatrakProducts.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPriceAtSubmission: numeric("unit_price_at_submission", { precision: 14, scale: 2 }).notNull().default("0"),
    unitCostAtSubmission: numeric("unit_cost_at_submission", { precision: 14, scale: 2 }).notNull().default("0"),
    totalPrice: numeric("total_price", { precision: 14, scale: 2 }).notNull().default("0"),
    totalCost: numeric("total_cost", { precision: 14, scale: 2 }).notNull().default("0"),
    profit: numeric("profit", { precision: 14, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    variantId: uuid("variant_id").references(() => numbatrakProductVariants.id, { onDelete: "set null" }),
    offerId: uuid("offer_id").references(() => numbatrakProductOffers.id, { onDelete: "set null" }),
    quantityPaid: integer("quantity_paid"),
    freeQuantity: integer("free_quantity").notNull().default(0),
    trueUnitCount: integer("true_unit_count"),
    // Set only when this line was added as an upsell (via addOrderUpsellLine)
    // after the order's original creation - null for lines inserted as part
    // of the initial order. Non-null is definitionally "this is an upsell
    // line," so no separate isUpsell flag is needed. Drives Payroll's
    // per-staff upsell-bonus count (the person who added the upsell earns
    // the bonus, per the Orders module's own confirmed decision).
    addedByUserId: text("added_by_user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    index("numbatrak_customer_order_items_order_idx").on(table.orderId),
    index("numbatrak_customer_order_items_product_idx").on(table.productId),
    check("numbatrak_customer_order_items_quantity_chk", sql`${table.quantity} > 0`),
  ],
);

// ---------------------------------------------------------------------------
// order_inventory_consumption - FIFO lot consumption ledger for an order
// ---------------------------------------------------------------------------

export const numbatrakOrderInventoryConsumption = pgTable(
  "numbatrak_order_inventory_consumption",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Source FK target is form_responses(id), NOT customer_orders(id) -
    // preserved exactly; every order's FIFO consumption is recorded against
    // the intake row.
    orderId: uuid("order_id")
      .notNull()
      .references(() => numbatrakFormResponses.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => numbatrakFormResponseItems.id, { onDelete: "cascade" }),
    inventoryLotId: uuid("inventory_lot_id")
      .notNull()
      .references(() => numbatrakInventoryLots.id, { onDelete: "restrict" }),
    quantityConsumed: integer("quantity_consumed").notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("numbatrak_order_inventory_consumption_lot_idx").on(table.inventoryLotId),
    index("numbatrak_order_inventory_consumption_order_idx").on(table.orderId),
    index("numbatrak_order_inventory_consumption_org_idx").on(table.organizationId),
    check("numbatrak_order_inventory_consumption_qty_chk", sql`${table.quantityConsumed} > 0`),
  ],
);
