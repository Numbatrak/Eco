import { sql } from "drizzle-orm";
import { check, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "../../auth-schema.js";
import { numbatrakCustomerOrders } from "./orders.js";

export const numbatrakInvoices = pgTable(
  "numbatrak_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => numbatrakCustomerOrders.id, { onDelete: "set null" }),
    invoiceNumber: text("invoice_number").notNull(),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    customerAddress: text("customer_address"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    deliveryFee: numeric("delivery_fee", { precision: 14, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
    lineItems: text("line_items").notNull().default("[]"),
    notes: text("notes"),
    status: text("status").notNull().default("draft"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_invoices_org_idx").on(table.organizationId),
    index("numbatrak_invoices_order_idx").on(table.orderId),
    index("numbatrak_invoices_status_idx").on(table.organizationId, table.status),
    check(
      "numbatrak_invoices_status_chk",
      sql`${table.status} IN ('draft', 'sent', 'paid', 'void')`,
    ),
  ],
);
