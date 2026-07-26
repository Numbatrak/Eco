import { sql } from "drizzle-orm";
import { boolean, check, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "../../auth-schema.js";
import { numbatrakStaff } from "./staff.js";

export const numbatrakCustomers = pgTable(
  "numbatrak_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    whatsapp: text("whatsapp"),
    location: text("location"),
    firstClickSource: text("first_click_source"),
    lastClickSource: text("last_click_source"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_customers_org_idx").on(table.organizationId),
    uniqueIndex("numbatrak_customers_org_phone_unique_idx").on(table.organizationId, table.phone),
  ],
);

export const numbatrakFeedbackSettings = pgTable(
  "numbatrak_feedback_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    callWindowDays: integer("call_window_days").notNull().default(3),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("numbatrak_feedback_settings_org_unique_idx").on(table.organizationId),
  ],
);

export const numbatrakFeedbackCalls = pgTable(
  "numbatrak_feedback_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => numbatrakCustomers.id, { onDelete: "cascade" }),
    orderId: text("order_id"),
    assignedTo: text("assigned_to").references(() => user.id, { onDelete: "set null" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    disposition: text("disposition"),
    satisfactionScore: integer("satisfaction_score"),
    reorderLikelihood: text("reorder_likelihood"),
    callbackAt: timestamp("callback_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_feedback_calls_org_idx").on(table.organizationId),
    index("numbatrak_feedback_calls_customer_idx").on(table.customerId),
    index("numbatrak_feedback_calls_assigned_idx").on(table.assignedTo),
    check(
      "numbatrak_feedback_calls_disposition_chk",
      sql`${table.disposition} IS NULL OR ${table.disposition} IN ('answered', 'no_answer', 'wrong_number', 'switched_off', 'unreachable', 'callback_requested')`,
    ),
    check(
      "numbatrak_feedback_calls_reorder_chk",
      sql`${table.reorderLikelihood} IS NULL OR ${table.reorderLikelihood} IN ('definitely', 'maybe', 'no', 'unlikely')`,
    ),
  ],
);

export const numbatrakComplaints = pgTable(
  "numbatrak_complaints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => numbatrakCustomers.id, { onDelete: "cascade" }),
    orderId: text("order_id"),
    complaintType: text("complaint_type"),
    description: text("description").notNull(),
    attachments: text("attachments"),
    status: text("status").notNull().default("open"),
    resolution: text("resolution"),
    resolutionType: text("resolution_type"),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_complaints_org_idx").on(table.organizationId),
    index("numbatrak_complaints_customer_idx").on(table.customerId),
    check(
      "numbatrak_complaints_status_chk",
      sql`${table.status} IN ('open', 'escalated', 'resolved')`,
    ),
    check(
      "numbatrak_complaints_type_chk",
      sql`${table.complaintType} IS NULL OR ${table.complaintType} IN ('wrong_size', 'damaged', 'never_received', 'wrong_product', 'quality_issue', 'other')`,
    ),
    check(
      "numbatrak_complaints_resolution_type_chk",
      sql`${table.resolutionType} IS NULL OR ${table.resolutionType} IN ('refund', 'replacement', 'other')`,
    ),
  ],
);

export const numbatrakMorePurchases = pgTable(
  "numbatrak_more_purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => numbatrakCustomers.id, { onDelete: "cascade" }),
    feedbackCallId: uuid("feedback_call_id").references(() => numbatrakFeedbackCalls.id, { onDelete: "set null" }),
    productId: text("product_id"),
    productName: text("product_name"),
    quantity: integer("quantity").notNull().default(1),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
    cogs: numeric("cogs", { precision: 14, scale: 2 }).notNull().default("0"),
    deliveryCost: numeric("delivery_cost", { precision: 12, scale: 2 }).notNull().default("0"),
    agentId: text("agent_id"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_more_purchases_org_idx").on(table.organizationId),
    index("numbatrak_more_purchases_customer_idx").on(table.customerId),
    check(
      "numbatrak_more_purchases_status_chk",
      sql`${table.status} IN ('pending', 'dispatched', 'delivered', 'failed')`,
    ),
  ],
);

export const numbatrakCampaigns = pgTable(
  "numbatrak_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    channel: text("channel").notNull(),
    segmentFilter: text("segment_filter"),
    subject: text("subject"),
    body: text("body").notNull(),
    recipientCount: integer("recipient_count").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    status: text("status").notNull().default("draft"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_campaigns_org_idx").on(table.organizationId),
    check(
      "numbatrak_campaigns_channel_chk",
      sql`${table.channel} IN ('email', 'whatsapp')`,
    ),
    check(
      "numbatrak_campaigns_status_chk",
      sql`${table.status} IN ('draft', 'sending', 'sent', 'failed')`,
    ),
  ],
);

export const numbatrakCrmCredits = pgTable(
  "numbatrak_crm_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    balance: integer("balance").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("numbatrak_crm_credits_org_channel_unique_idx").on(table.organizationId, table.channel),
    check(
      "numbatrak_crm_credits_channel_chk",
      sql`${table.channel} IN ('email', 'whatsapp')`,
    ),
  ],
);
