// Numbatrak domain: partial/abandoned form submissions. Source `public.abandoned_carts`.
// `convertedOrderId` was explicitly repointed from the legacy `orders` table
// to `customer_orders` by migration 20260720190000 - this is the one legacy
// FK in the source schema that WAS cleaned up (contrast with
// follow_ups.order_id, which was not - see follow-ups.ts).
import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organization } from "../../auth-schema.js";
import { numbatrakForms } from "./forms.js";
import { numbatrakCustomerOrders } from "./orders.js";

export const numbatrakAbandonedCarts = pgTable(
  "numbatrak_abandoned_carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    formId: uuid("form_id").references(() => numbatrakForms.id, { onDelete: "set null" }),
    pageUrl: text("page_url"),
    filledFields: jsonb("filled_fields"),
    fieldValues: jsonb("field_values"),
    selectedProducts: jsonb("selected_products"),
    convertedToOrder: boolean("converted_to_order").default(false),
    convertedOrderId: uuid("converted_order_id").references(() => numbatrakCustomerOrders.id, {
      onDelete: "set null",
    }),
    abandonedAt: timestamp("abandoned_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    customerName: text("customer_name"),
    phoneNumber: text("phone_number"),
    whatsappNumber: text("whatsapp_number"),
    deliveryAddress: text("delivery_address"),
    state: text("state"),
    location: text("location"),
    selectedPackage: text("selected_package"),
    selectedItems: text("selected_items"),
    productName: text("product_name"),
    mailQuan: integer("mail_quan"),
    agentQuan: integer("agent_quan"),
    quantity: integer("quantity"),
    product2: text("product2"),
    mailQuan2: integer("mail_quan2"),
    agentQuan2: integer("agent_quan2"),
    quantity2: integer("quantity2"),
    filledFieldsCount: integer("filled_fields_count").default(0),
    note: text("note"),
    subject: text("subject"),
    orderDate: date("order_date").notNull().default(sql`CURRENT_DATE`),
    orderMonth: text("order_month"),
    orderYear: text("order_year"),
    costPrice: numeric("cost_price", { precision: 10, scale: 2 }),
    deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }),
    profit: numeric("profit", { precision: 10, scale: 2 }),
    orderStatus: text("order_status").default("Pending"),
    deliveryDate: date("delivery_date"),
    deliveryMonth: text("delivery_month"),
    deliveryYear: text("delivery_year"),
    confirmedDelivery: boolean("confirmed_delivery").default(false),
    agentName: text("agent_name"),
    salesPrice: numeric("sales_price", { precision: 10, scale: 2 }),
    // Stabilization additions (migration 20260720190000)
    funnelName: text("funnel_name"),
    offerName: text("offer_name"),
    subBrand: text("sub_brand"),
  },
  (table) => [
    index("numbatrak_abandoned_carts_abandoned_at_idx").on(table.abandonedAt),
    index("numbatrak_abandoned_carts_converted_idx").on(table.convertedToOrder),
    index("numbatrak_abandoned_carts_customer_name_idx").on(table.customerName),
    index("numbatrak_abandoned_carts_form_id_idx").on(table.formId),
    index("numbatrak_abandoned_carts_org_idx").on(table.organizationId),
    index("numbatrak_abandoned_carts_funnel_idx")
      .on(table.organizationId, table.funnelName)
      .where(sql`${table.funnelName} IS NOT NULL`),
    index("numbatrak_abandoned_carts_offer_idx")
      .on(table.organizationId, table.offerName)
      .where(sql`${table.offerName} IS NOT NULL`),
  ],
);
