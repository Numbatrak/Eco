import { sql } from "drizzle-orm";
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

// ---------- enums ----------

export const tenantMemberRoleEnum = pgEnum("tenant_member_role", ["owner", "admin", "member"]);

export const preferred2faMethodEnum = pgEnum("preferred_2fa_method", ["totp", "email_otp"]);

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

// ---------- tenants ----------

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // Nullable until set via PATCH /tenants/:tenantId - registration only
    // collects a business name, not a subdomain.
    subdomain: text("subdomain"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("tenants_subdomain_unique_idx").on(sql`lower(${table.subdomain})`)],
);

// ---------- users ----------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    totpSecretEncrypted: text("totp_secret_encrypted"),
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
    emailOtpEnabledAt: timestamp("email_otp_enabled_at", { withTimezone: true }),
    preferred2faMethod: preferred2faMethodEnum("preferred_2fa_method"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique_idx").on(sql`lower(${table.email})`)],
);

// ---------- tenant_members ----------

export const tenantMembers = pgTable(
  "tenant_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: tenantMemberRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("tenant_members_tenant_user_unique_idx").on(table.tenantId, table.userId),
    index("tenant_members_user_idx").on(table.userId),
  ],
);

// ---------- permissions ----------

/** Reference table of grantable permission keys - seeded, not user-editable. */
export const permissions = pgTable("permissions", {
  key: text("key").primaryKey(),
  description: text("description").notNull(),
});

export const tenantMemberPermissions = pgTable(
  "tenant_member_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantMemberId: uuid("tenant_member_id")
      .notNull()
      .references(() => tenantMembers.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => permissions.key, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("tenant_member_permissions_unique_idx").on(
      table.tenantMemberId,
      table.permissionKey,
    ),
    index("tenant_member_permissions_member_idx").on(table.tenantMemberId),
  ],
);

// ---------- refresh_tokens ----------

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("refresh_tokens_user_idx").on(table.userId),
    uniqueIndex("refresh_tokens_token_hash_unique_idx").on(table.tokenHash),
  ],
);

// ---------- backup_codes ----------

export const backupCodes = pgTable(
  "backup_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("backup_codes_user_idx").on(table.userId)],
);

// ---------- security_events ----------

export const securityEvents = pgTable(
  "security_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
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
 * with no editor behind them yet in this task.
 */
export const tenantSiteConfig = pgTable("tenant_site_config", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  theme: jsonb("theme").notNull().default({}),
  sections: jsonb("sections").notNull().default([]),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- products ----------

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
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
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
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
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
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
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
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
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
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

// ---------- aggregate schema export ----------

export const schema = {
  tenants,
  users,
  tenantMembers,
  permissions,
  tenantMemberPermissions,
  refreshTokens,
  backupCodes,
  securityEvents,
  tenantSiteConfig,
  products,
  carts,
  cartItems,
  orders,
  orderItems,
  tenantPaymentSettings,
  paymentWebhookEvents,
};
