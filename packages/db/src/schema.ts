import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { account, invitation, member, organization, session, twoFactor, user, verification } from "./auth-schema.js";
import {
  platformAdminAccount,
  platformAdminSession,
  platformAdminTwoFactor,
  platformAdminUser,
  platformAdminVerification,
} from "./platform-admin-auth-schema.js";

export * from "./auth-schema.js";
export * from "./platform-admin-auth-schema.js";

// ---------- enums ----------

export const securityEventTypeEnum = pgEnum("security_event_type", [
  "login_success",
  "login_failed",
  "2fa_challenge_issued",
  "2fa_verified",
  "2fa_failed",
  "2fa_enabled",
  "2fa_disabled",
  "backup_code_used",
  "backup_codes_regenerated",
  "password_reset_requested",
  "password_reset_completed",
  "sessions_revoked",
]);

export const productStatusEnum = pgEnum("product_status", ["draft", "published"]);

export const orderStatusEnum = pgEnum("order_status", ["pending", "paid", "failed", "cancelled"]);

export const paymentProviderEnum = pgEnum("payment_provider", ["paystack", "flutterwave"]);

export const paymentModeEnum = pgEnum("payment_mode", ["test", "live"]);

// ---------- security_events ----------

export const securityEvents = pgTable(
  "security_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    eventType: securityEventTypeEnum("event_type").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("security_events_user_idx").on(table.userId),
    index("security_events_event_type_idx").on(table.eventType),
  ],
);

// ---------- tenant_site_config ----------

/**
 * Minimal stub backing GET /public/sites/:subdomain until the real
 * storefront-builder backend exists - theme/sections are opaque JSON blobs
 * with no editor behind them yet in this task. productsGridEnabled is a
 * standalone toggle (not a general reorderable section list, which is out
 * of scope) for showing a live product grid on the site.
 */
export const tenantSiteConfig = pgTable("tenant_site_config", {
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  theme: jsonb("theme").notNull().default({}),
  sections: jsonb("sections").notNull().default([]),
  productsGridEnabled: boolean("products_grid_enabled").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- products ----------

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull(),
    imageUrl: text("image_url"),
    status: productStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("products_tenant_idx").on(table.tenantId),
    index("products_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

// ---------- carts ----------

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    cartToken: text("cart_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("carts_cart_token_unique_idx").on(table.cartToken),
    index("carts_tenant_idx").on(table.tenantId),
  ],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    // Captured when the item is added, so a later price edit doesn't
    // retroactively change an already-open cart.
    unitPriceSnapshotCents: integer("unit_price_snapshot_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cart_items_cart_product_unique_idx").on(table.cartId, table.productId),
    index("cart_items_cart_idx").on(table.cartId),
  ],
);

// ---------- orders ----------

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    orderNumber: text("order_number").notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    status: orderStatusEnum("status").notNull().default("pending"),
    currency: text("currency").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    paymentProvider: paymentProviderEnum("payment_provider").notNull(),
    paymentReference: text("payment_reference"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_order_number_unique_idx").on(table.orderNumber),
    uniqueIndex("orders_payment_reference_unique_idx").on(table.paymentReference),
    index("orders_tenant_idx").on(table.tenantId),
    index("orders_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    // Nullable + set null on delete: the order record must survive the
    // underlying product being deleted later - nameSnapshot preserves it.
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    nameSnapshot: text("name_snapshot").notNull(),
    unitPriceSnapshotCents: integer("unit_price_snapshot_cents").notNull(),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);

// ---------- tenant_payment_settings ----------

export const tenantPaymentSettings = pgTable("tenant_payment_settings", {
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  provider: paymentProviderEnum("provider").notNull(),
  publicKey: text("public_key"),
  secretKeyEncrypted: text("secret_key_encrypted"),
  mode: paymentModeEnum("mode").notNull().default("test"),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- payment_webhook_events ----------

export const paymentWebhookEvents = pgTable(
  "payment_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id").references(() => organization.id, { onDelete: "set null" }),
    provider: paymentProviderEnum("provider").notNull(),
    eventReference: text("event_reference").notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payment_webhook_events_provider_reference_unique_idx").on(
      table.provider,
      table.eventReference,
    ),
    index("payment_webhook_events_tenant_idx").on(table.tenantId),
  ],
);

// ---------- credit_adjustments ----------

/**
 * Every manual credit change, no exceptions - this task only adds the
 * override + audit trail, not a stored running balance (a tenant's balance
 * is SUM(delta) computed on read, see modules/platform-admin/lib).
 */
export const creditAdjustments = pgTable(
  "credit_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    adminId: text("admin_id").references(() => platformAdminUser.id, { onDelete: "set null" }),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("credit_adjustments_tenant_idx").on(table.tenantId)],
);

// ---------- reserved_subdomains ----------

/**
 * Source of truth for reserved subdomains, replacing the old
 * RESERVED_SUBDOMAINS env var - checked by the organization-creation hook in
 * apps/api/src/lib/auth.ts via isReservedSubdomain().
 */
export const reservedSubdomains = pgTable("reserved_subdomains", {
  word: text("word").primaryKey(),
  addedBy: text("added_by").references(() => platformAdminUser.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- feature_flags ----------

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- platform_settings ----------

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- platform_admin_audit_log ----------

export const platformAdminAuditLog = pgTable(
  "platform_admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: text("admin_id").references(() => platformAdminUser.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("platform_admin_audit_log_admin_idx").on(table.adminId),
    index("platform_admin_audit_log_created_at_idx").on(table.createdAt),
  ],
);

// ---------- aggregate schema export ----------

export const schema = {
  user,
  session,
  account,
  verification,
  organization,
  member,
  invitation,
  twoFactor,
  platformAdminUser,
  platformAdminSession,
  platformAdminAccount,
  platformAdminVerification,
  platformAdminTwoFactor,
  securityEvents,
  tenantSiteConfig,
  products,
  carts,
  cartItems,
  orders,
  orderItems,
  tenantPaymentSettings,
  paymentWebhookEvents,
  creditAdjustments,
  reservedSubdomains,
  featureFlags,
  platformSettings,
  platformAdminAuditLog,
};
