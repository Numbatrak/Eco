import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  date,
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
import { numbatrakSchema } from "./schema/numbatrak/index.js";

export * from "./auth-schema.js";
export * from "./platform-admin-auth-schema.js";
export * from "./schema/numbatrak/index.js";

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

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "shipped",
  "delivered",
  "failed",
  "cancelled",
]);

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

// ---------- collections ----------

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("collections_tenant_slug_unique_idx").on(table.tenantId, table.slug),
    index("collections_tenant_idx").on(table.tenantId),
  ],
);

// ---------- products ----------

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id").references(() => collections.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    // Nullable: only set when the product is on sale, for strike-through display.
    compareAtPriceCents: integer("compare_at_price_cents"),
    currency: text("currency").notNull(),
    imageUrl: text("image_url"),
    status: productStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("products_tenant_idx").on(table.tenantId),
    index("products_tenant_status_idx").on(table.tenantId, table.status),
    index("products_collection_idx").on(table.collectionId),
  ],
);

// ---------- product_variants ----------

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    size: text("size").notNull(),
    color: text("color").notNull(),
    stockCount: integer("stock_count").notNull().default(0),
    isAvailable: boolean("is_available").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("product_variants_product_size_color_unique_idx").on(
      table.productId,
      table.size,
      table.color,
    ),
    index("product_variants_product_idx").on(table.productId),
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
    // Nullable: only set for products that have variants. Postgres treats
    // NULLs as distinct in a unique index, so variant-less products still
    // dedupe correctly on (cartId, productId) alone.
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    quantity: integer("quantity").notNull().default(1),
    // Captured when the item is added, so a later price edit doesn't
    // retroactively change an already-open cart.
    unitPriceSnapshotCents: integer("unit_price_snapshot_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cart_items_cart_product_variant_unique_idx").on(
      table.cartId,
      table.productId,
      table.variantId,
    ),
    index("cart_items_cart_idx").on(table.cartId),
  ],
);

// ---------- customers ----------

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    // Both derived from paid orders only (see markOrderPaid) - never
    // incremented at pending-order creation, so abandoned/failed checkouts
    // don't inflate a customer's stats.
    orderCount: integer("order_count").notNull().default(0),
    totalSpentCents: integer("total_spent_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("customers_tenant_email_unique_idx").on(table.tenantId, table.email),
    index("customers_tenant_idx").on(table.tenantId),
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
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    orderNumber: text("order_number").notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    status: orderStatusEnum("status").notNull().default("pending"),
    currency: text("currency").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    // Server-computed at checkout from tenant_delivery_settings - never
    // trust a client-sent value here (see quoteDelivery).
    deliveryAddress: text("delivery_address"),
    deliveryCity: text("delivery_city"),
    deliveryState: text("delivery_state"),
    deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
    vatRateBps: integer("vat_rate_bps"),
    vatAmountCents: integer("vat_amount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    paymentProvider: paymentProviderEnum("payment_provider").notNull(),
    paymentReference: text("payment_reference"),
    // Attribution - captured client-side (sticky-first per session), passed
    // through checkout, never authoritative for pricing.
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmTerm: text("utm_term"),
    utmContent: text("utm_content"),
    referrer: text("referrer"),
    landingPath: text("landing_path"),
    fbclid: text("fbclid"),
    ttclid: text("ttclid"),
    gclid: text("gclid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_order_number_unique_idx").on(table.orderNumber),
    uniqueIndex("orders_payment_reference_unique_idx").on(table.paymentReference),
    index("orders_tenant_idx").on(table.tenantId),
    index("orders_tenant_status_idx").on(table.tenantId, table.status),
    index("orders_customer_idx").on(table.customerId),
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

// ---------- tenant_delivery_settings ----------

export const tenantDeliverySettings = pgTable("tenant_delivery_settings", {
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  vatEnabled: boolean("vat_enabled").notNull().default(false),
  vatRateBps: integer("vat_rate_bps").notNull().default(0),
  deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
  freeDeliveryThresholdCents: integer("free_delivery_threshold_cents"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- tenant_analytics_settings ----------

export const tenantAnalyticsSettings = pgTable("tenant_analytics_settings", {
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  metaPixelId: text("meta_pixel_id"),
  metaCapiTokenEncrypted: text("meta_capi_token_encrypted"),
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

// ---------- platform_plans ----------

export const platformSubscriptionStatusEnum = pgEnum("platform_subscription_status", [
  "trial",
  "active",
  "past_due",
  "locked",
  "cancelled",
]);

export const platformTransactionTypeEnum = pgEnum("platform_transaction_type", [
  "subscription",
  "credit_purchase",
]);

export const platformTransactionStatusEnum = pgEnum("platform_transaction_status", [
  "success",
  "failed",
  "refunded",
]);

export const platformCreditTypeEnum = pgEnum("platform_credit_type", ["email", "whatsapp"]);

export const affiliateStatusEnum = pgEnum("affiliate_status", ["active", "paused"]);

export const announcementAudienceEnum = pgEnum("announcement_audience", ["all", "tier", "tenant"]);

export const exitSurveyTypeEnum = pgEnum("exit_survey_type", ["cancel", "delete"]);

export const expenseParentCategoryEnum = pgEnum("expense_parent_category", [
  "advertising",
  "marketing",
  "building",
  "operational",
]);

export const platformPlans = pgTable("platform_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Stable slug used in code ("starter" | "growth" | "pro")
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  priceMonthlyCents: integer("price_monthly_cents").notNull(),
  priceAnnuallyCents: integer("price_annually_cents").notNull(),
  // Numeric ceilings per plan, not on/off feature switches.
  // Keys: staffRecordCount, seatCount, monthlyOrderVolume, storefrontCount,
  //       monthlyEmailCredits, monthlyWhatsappCredits.
  // -1 = unlimited (Pro tier).
  limits: jsonb("limits").notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- platform_subscriptions ----------

export const platformSubscriptions = pgTable(
  "platform_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => platformPlans.id, { onDelete: "restrict" }),
    status: platformSubscriptionStatusEnum("status").notNull().default("trial"),
    billingInterval: text("billing_interval").notNull().default("monthly"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    // Copied from the organization's signup attribution at conversion — "every
    // subscription carries the same UTMs from the signup that converted"
    // (SuperAdmin.docx). Frozen here so paying-user acquisition-channel
    // reporting is stable even if the org row is later touched.
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    // Set on payment failure to NOW() + 48h. Cleared on recovery.
    gracePeriodEndsAt: timestamp("grace_period_ends_at", { withTimezone: true }),
    // Set when grace expires — account is locked, data intact, no auto-cancel.
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    paystackSubscriptionCode: text("paystack_subscription_code"),
    paystackCustomerCode: text("paystack_customer_code"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One active subscription per org
    uniqueIndex("platform_subscriptions_org_unique_idx").on(table.organizationId),
    index("platform_subscriptions_status_idx").on(table.status),
    // Cron queries: find past_due rows whose grace window has closed
    index("platform_subscriptions_grace_period_idx").on(table.gracePeriodEndsAt),
    // Cron queries: find locked rows past the 90-day delete threshold
    index("platform_subscriptions_locked_at_idx").on(table.lockedAt),
  ],
);

// ---------- platform_transactions ----------

// Single source of truth for MRR/ARR — never computed any other way.
// Never conflate with tenant payment_webhook_events; this is Platform
// charging its tenants, not tenants charging their shoppers.
export const platformTransactions = pgTable(
  "platform_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable + set-null on delete: the revenue ledger is the single source
    // of truth for MRR/revenue and must SURVIVE a tenant data-wipe (delete
    // tenant), so past-period revenue numbers never change retroactively. The
    // org is always set at creation; it's only nulled if that tenant is later
    // deleted.
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    type: platformTransactionTypeEnum("type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    vatCents: integer("vat_cents").notNull().default(0),
    paystackReference: text("paystack_reference").notNull(),
    status: platformTransactionStatusEnum("status").notNull(),
    // Captures planId, period, payment channel, etc. — kept flexible so future
    // transaction types don't require schema changes.
    metadata: jsonb("metadata"),
    // Set when a refund is issued. refundedAt is queried for "refunds in the
    // period they were issued" (LOCKED RULE: a refund reduces revenue for the
    // period it is issued, not the original charge's period).
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    refundReason: text("refund_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("platform_transactions_reference_unique_idx").on(table.paystackReference),
    index("platform_transactions_org_idx").on(table.organizationId),
    index("platform_transactions_status_idx").on(table.status),
    index("platform_transactions_created_at_idx").on(table.createdAt),
    index("platform_transactions_refunded_at_idx").on(table.refundedAt),
  ],
);

// ---------- platform_billing_webhook_events ----------

// Idempotency table for Platform's OWN Paystack account.
// Distinct from payment_webhook_events which handles tenant Paystack/Flutterwave.
export const platformBillingWebhookEvents = pgTable(
  "platform_billing_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventReference: text("event_reference").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("platform_billing_webhook_events_reference_unique_idx").on(table.eventReference),
  ],
);

// ---------- platform_credit_ledger ----------

// Mirrors credit_adjustments: no stored balance — balance is SUM(delta) on
// read. Covers email and WhatsApp credit pools separately per org.
export const platformCreditLedger = pgTable(
  "platform_credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    creditType: platformCreditTypeEnum("credit_type").notNull(),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    adminId: text("admin_id").references(() => platformAdminUser.id, { onDelete: "set null" }),
    transactionId: uuid("transaction_id").references(() => platformTransactions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("platform_credit_ledger_org_idx").on(table.organizationId),
    index("platform_credit_ledger_org_type_idx").on(table.organizationId, table.creditType),
  ],
);

// ---------- user_activity_days ----------

// One row per (user, calendar day) the user was active. Powers DAU (distinct
// users on a date), MAU (distinct users over a trailing window), unique-active-
// today, and last-login. A daily rollup, not an event log — kept lightweight by
// upserting the same row on repeat activity within a day.
export const userActivityDays = pgTable(
  "user_activity_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    activityDate: date("activity_date").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_activity_days_user_date_unique_idx").on(table.userId, table.activityDate),
    index("user_activity_days_date_idx").on(table.activityDate),
    index("user_activity_days_org_idx").on(table.organizationId),
  ],
);

// ---------- platform_metric_snapshots ----------

// Daily point-in-time rollup of platform health, written by the metrics-snapshot
// cron. Backs the metrics that need historical state — churn ("active at start
// of period"), NRR ("MRR start vs end"), and the 4/8/12-week trend lines —
// which would otherwise require reconstructing past state on every query.
export const platformMetricSnapshots = pgTable(
  "platform_metric_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotDate: date("snapshot_date").notNull(),
    mrrCents: integer("mrr_cents").notNull().default(0),
    arrCents: integer("arr_cents").notNull().default(0),
    activeSubscriptions: integer("active_subscriptions").notNull().default(0),
    trialAccounts: integer("trial_accounts").notNull().default(0),
    // { starter: n, growth: n, pro: n } — active count per plan tier.
    activeByTier: jsonb("active_by_tier").notNull().default({}),
    // Revenue *collected* on this day (from platform_transactions), split by stream.
    subscriptionRevenueCents: integer("subscription_revenue_cents").notNull().default(0),
    creditRevenueCents: integer("credit_revenue_cents").notNull().default(0),
    // Daily flow counters for churn/conversion math.
    newSignups: integer("new_signups").notNull().default(0),
    trialStarts: integer("trial_starts").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    churnedCount: integer("churned_count").notNull().default(0),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("platform_metric_snapshots_date_unique_idx").on(table.snapshotDate),
  ],
);

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

// ---------- affiliates ----------

// The referral programme. Affiliates never log into Super Admin (a separate
// affiliate dashboard is post-launch). Attribution is automatic via UTM: a
// referral link carries utm_source=affiliate, utm_medium=referral,
// utm_campaign=<code>, and the join to a signup is
// organization.signup_utm_campaign = affiliates.code.
export const affiliates = pgTable(
  "affiliates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email"),
    // Unique referral identifier baked into the link's utm_campaign.
    code: text("code").notNull(),
    // Commission rate in basis points. Default 1000 = 10% (LOCKED RULE),
    // settable per affiliate.
    commissionRateBps: integer("commission_rate_bps").notNull().default(1000),
    status: affiliateStatusEnum("status").notNull().default("active"),
    createdByAdminId: text("created_by_admin_id").references(() => platformAdminUser.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("affiliates_code_unique_idx").on(table.code)],
);

// Payouts are recorded, not disbursed — Numbatrak calculates commission and
// marks it paid here (paid outside the system, same pattern as staff payroll).
export const affiliatePayouts = pgTable(
  "affiliate_payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    affiliateId: uuid("affiliate_id")
      .notNull()
      .references(() => affiliates.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    note: text("note"),
    recordedByAdminId: text("recorded_by_admin_id").references(() => platformAdminUser.id, {
      onDelete: "set null",
    }),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("affiliate_payouts_affiliate_idx").on(table.affiliateId)],
);

// ---------- credit pricing + bundles (Tab 4) ----------

// Global credit pricing (LOCKED RULE: not per-tenant). One row per credit type.
// sellPriceCents is what a tenant pays per credit; providerCostCents is what
// Numbatrak's provider charges per send — the gap is the margin. Prices apply
// to new purchases only (the ledger is append-only, so existing balances are
// untouched).
export const platformCreditPricing = pgTable("platform_credit_pricing", {
  creditType: platformCreditTypeEnum("credit_type").primaryKey(),
  sellPriceCents: integer("sell_price_cents").notNull().default(0),
  providerCostCents: integer("provider_cost_cents").notNull().default(0),
  updatedByAdminId: text("updated_by_admin_id").references(() => platformAdminUser.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Volume bundles (buy N credits at a set price) — incentivise bulk purchases.
export const creditBundles = pgTable(
  "credit_bundles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creditType: platformCreditTypeEnum("credit_type").notNull(),
    name: text("name").notNull(),
    units: integer("units").notNull(),
    priceCents: integer("price_cents").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("credit_bundles_type_idx").on(table.creditType)],
);

// ---------- announcements (Operations) ----------

// A broadcast to tenants. Audience is all tenants, a plan tier, or a single
// tenant. recipientCount is resolved at send time. Actual delivery to the
// tenant notification bell / email is a separate (cross-app) concern; this row
// is the record of what was broadcast.
export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audience: announcementAudienceEnum("audience").notNull(),
  // Null for "all"; a plan-tier name for "tier"; an organization id for "tenant".
  audienceValue: text("audience_value"),
  sendEmail: boolean("send_email").notNull().default(false),
  recipientCount: integer("recipient_count").notNull().default(0),
  createdByAdminId: text("created_by_admin_id").references(() => platformAdminUser.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- exit_surveys (churn analytics) ----------

// Captured when a tenant cancels or deletes. planTierAtExit and tenureDays are
// snapshotted at exit so churn analytics stays correct even after the tenant is
// gone (organization_id is set null on delete).
export const exitSurveys = pgTable(
  "exit_surveys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "set null" }),
    exitType: exitSurveyTypeEnum("exit_type").notNull(),
    reasonCategory: text("reason_category").notNull(),
    detail: text("detail"),
    planTierAtExit: text("plan_tier_at_exit"),
    tenureDays: integer("tenure_days"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("exit_surveys_created_at_idx").on(table.createdAt)],
);

// ---------- platform_error_log (Operations) ----------

// System errors, failed webhook deliveries, API failures. Written by the API's
// error handler and any surface that wants to record a failure for the Ops view.
export const platformErrorLog = pgTable(
  "platform_error_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(), // api | webhook | cron | ...
    level: text("level").notNull().default("error"),
    message: text("message").notNull(),
    context: jsonb("context"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("platform_error_log_created_at_idx").on(table.createdAt),
    index("platform_error_log_source_idx").on(table.source),
  ],
);

// ---------- business metrics / expenses (Tab 7) ----------

export const expenseSubCategories = pgTable(
  "expense_sub_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentCategory: expenseParentCategoryEnum("parent_category").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("expense_sub_categories_parent_idx").on(table.parentCategory),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentCategory: expenseParentCategoryEnum("parent_category").notNull(),
    subCategoryId: uuid("sub_category_id").references(() => expenseSubCategories.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    recordedByAdminId: text("recorded_by_admin_id").references(() => platformAdminUser.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("expenses_occurred_at_idx").on(table.occurredAt),
    index("expenses_parent_category_idx").on(table.parentCategory),
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
  collections,
  products,
  productVariants,
  carts,
  cartItems,
  customers,
  orders,
  orderItems,
  tenantPaymentSettings,
  tenantDeliverySettings,
  tenantAnalyticsSettings,
  paymentWebhookEvents,
  creditAdjustments,
  reservedSubdomains,
  featureFlags,
  platformSettings,
  platformAdminAuditLog,
  platformPlans,
  platformSubscriptions,
  platformTransactions,
  platformBillingWebhookEvents,
  platformCreditLedger,
  userActivityDays,
  platformMetricSnapshots,
  affiliates,
  affiliatePayouts,
  announcements,
  exitSurveys,
  platformErrorLog,
  platformCreditPricing,
  creditBundles,
  expenseSubCategories,
  expenses,
  ...numbatrakSchema,
};
