import { z } from "zod";

// ---------- shared ----------

export const tenantStatusSchema = z.enum(["active", "suspended"]);
export type TenantStatus = z.infer<typeof tenantStatusSchema>;

// ---------- login ----------

export const platformAdminLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
export type PlatformAdminLoginRequest = z.infer<typeof platformAdminLoginRequestSchema>;

// ---------- tenants: list/detail (Tab 2) ----------

// Unified lifecycle status = org suspension (admin block, takes precedence)
// combined with the subscription state. Matches the Tab 2 status column plus
// the dunning states (past_due = within 48h grace, locked = past grace).
export const tenantLifecycleStatusSchema = z.enum([
  "active",
  "trial",
  "past_due",
  "locked",
  "cancelled",
  "suspended",
]);
export type TenantLifecycleStatus = z.infer<typeof tenantLifecycleStatusSchema>;

export const platformAdminTenantsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  // Search matches business name, subdomain, owner email, or phone.
  search: z.string().trim().min(1).max(200).optional(),
  plan: z.string().trim().min(1).max(100).optional(),
  status: tenantLifecycleStatusSchema.optional(),
  signupSource: z.string().trim().min(1).max(200).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type PlatformAdminTenantsQuery = z.infer<typeof platformAdminTenantsQuerySchema>;

export const platformAdminTenantSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  subdomain: z.string(),
  ownerEmail: z.string().nullable(),
  status: tenantLifecycleStatusSchema,
  planTier: z.string().nullable(),
  mrrContributionCents: z.number().int(),
  teamSize: z.number().int(),
  signupSource: z.string().nullable(),
  emailCredits: z.number().int(),
  whatsappCredits: z.number().int(),
  lastActiveAt: z.string().nullable(),
  createdAt: z.string(),
});
export type PlatformAdminTenantSummary = z.infer<typeof platformAdminTenantSummarySchema>;

export const platformAdminTenantsResponseSchema = z.object({
  tenants: z.array(platformAdminTenantSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type PlatformAdminTenantsResponse = z.infer<typeof platformAdminTenantsResponseSchema>;

// (1) Account details + plan + subscription
export const tenantSubscriptionSchema = z.object({
  planTier: z.string().nullable(),
  billingInterval: z.string().nullable(),
  status: tenantLifecycleStatusSchema,
  mrrContributionCents: z.number().int(),
  currentPeriodEnd: z.string().nullable(),
  trialEndsAt: z.string().nullable(),
  gracePeriodEndsAt: z.string().nullable(),
  lockedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  inRetentionWindow: z.boolean(),
  deletable: z.boolean(),
});
export type TenantSubscription = z.infer<typeof tenantSubscriptionSchema>;

// (2) Payment history
export const tenantTransactionSchema = z.object({
  id: z.string(),
  type: z.string(),
  amountCents: z.number().int(),
  vatCents: z.number().int(),
  paystackReference: z.string(),
  status: z.string(),
  createdAt: z.string(),
});
export type TenantTransaction = z.infer<typeof tenantTransactionSchema>;

// (3) Feature usage — a capability snapshot at launch (full adoption
// telemetry is Tab 6 territory and tracked separately).
export const tenantCapabilitiesSchema = z.object({
  productCount: z.number().int(),
  publishedProductCount: z.number().int(),
  collectionCount: z.number().int(),
  orderCount: z.number().int(),
  storefrontPublished: z.boolean(),
  paymentConfigured: z.boolean(),
  analyticsConfigured: z.boolean(),
  deliveryConfigured: z.boolean(),
});
export type TenantCapabilities = z.infer<typeof tenantCapabilitiesSchema>;

// (4) Team members + roles
export const tenantTeamMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  joinedAt: z.string(),
});
export type TenantTeamMember = z.infer<typeof tenantTeamMemberSchema>;

// (5) Credits — two pools + ledger history
export const tenantCreditEntrySchema = z.object({
  id: z.string(),
  creditType: z.enum(["email", "whatsapp"]),
  delta: z.number().int(),
  reason: z.string(),
  source: z.enum(["admin_grant", "purchase", "consumption"]),
  createdAt: z.string(),
});
export type TenantCreditEntry = z.infer<typeof tenantCreditEntrySchema>;

export const tenantCreditsSchema = z.object({
  emailBalance: z.number().int(),
  whatsappBalance: z.number().int(),
  history: z.array(tenantCreditEntrySchema),
});
export type TenantCredits = z.infer<typeof tenantCreditsSchema>;

// (6) Activity log — admin actions taken on this tenant
export const tenantActivityEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  adminId: z.string().nullable(),
  details: z.unknown().nullable(),
  createdAt: z.string(),
});
export type TenantActivityEntry = z.infer<typeof tenantActivityEntrySchema>;

export const platformAdminTenantDetailSchema = platformAdminTenantSummarySchema.extend({
  subscription: tenantSubscriptionSchema.nullable(),
  transactions: z.array(tenantTransactionSchema),
  capabilities: tenantCapabilitiesSchema,
  team: z.array(tenantTeamMemberSchema),
  credits: tenantCreditsSchema,
  activity: z.array(tenantActivityEntrySchema),
});
export type PlatformAdminTenantDetail = z.infer<typeof platformAdminTenantDetailSchema>;

// ---------- tenant management actions ----------

export const updateTenantPlanRequestSchema = z.object({
  plan: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(1).max(500).optional(),
});
export type UpdateTenantPlanRequest = z.infer<typeof updateTenantPlanRequestSchema>;

// Grant credits to a specific pool (email/whatsapp) — writes to the typed
// platform_credit_ledger, superseding the old single-pool credit_adjustments.
export const grantTenantCreditsRequestSchema = z.object({
  creditType: z.enum(["email", "whatsapp"]),
  amount: z.number().int().refine((n) => n !== 0, "amount must be nonzero"),
  reason: z.string().trim().min(1).max(500),
});
export type GrantTenantCreditsRequest = z.infer<typeof grantTenantCreditsRequestSchema>;

export const extendTrialRequestSchema = z.object({
  days: z.number().int().min(1).max(90),
  reason: z.string().trim().min(1).max(500),
});
export type ExtendTrialRequest = z.infer<typeof extendTrialRequestSchema>;

export const suspendTenantRequestSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
export type SuspendTenantRequest = z.infer<typeof suspendTenantRequestSchema>;

// Delete is a full data wipe, guarded server-side by the 90-day retention
// window and gated by an explicit confirmation token (double-confirm UI).
export const deleteTenantRequestSchema = z.object({
  confirmation: z.literal("DELETE"),
  reason: z.string().trim().min(1).max(500),
});
export type DeleteTenantRequest = z.infer<typeof deleteTenantRequestSchema>;

// ---------- Revenue (Tab 3) ----------

export const revenueTransactionTypeSchema = z.enum(["subscription", "credit_purchase"]);
export const revenueTransactionStatusSchema = z.enum(["success", "failed", "refunded"]);

export const revenueLedgerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  type: revenueTransactionTypeSchema.optional(),
  status: revenueTransactionStatusSchema.optional(),
  tenantId: z.string().trim().min(1).optional(),
  tier: z.string().trim().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type RevenueLedgerQuery = z.infer<typeof revenueLedgerQuerySchema>;

export const revenueTransactionSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullable(),
  tenantName: z.string().nullable(),
  type: revenueTransactionTypeSchema,
  planTier: z.string().nullable(),
  paymentMethod: z.string().nullable(),
  amountCents: z.number().int(),
  vatCents: z.number().int(),
  paystackReference: z.string(),
  status: revenueTransactionStatusSchema,
  refundedAt: z.string().nullable(),
  refundReason: z.string().nullable(),
  createdAt: z.string(),
});
export type RevenueTransaction = z.infer<typeof revenueTransactionSchema>;

export const revenueLedgerResponseSchema = z.object({
  transactions: z.array(revenueTransactionSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type RevenueLedgerResponse = z.infer<typeof revenueLedgerResponseSchema>;

// Failed payments = the dunning pipeline. Our locked model has two live stages
// (grace = within 48h, locked = past grace); delete follows at 90 days.
export const failedPaymentStageSchema = z.enum(["grace", "locked"]);
export const failedPaymentSchema = z.object({
  organizationId: z.string(),
  tenantName: z.string(),
  ownerEmail: z.string().nullable(),
  stage: failedPaymentStageSchema,
  gracePeriodEndsAt: z.string().nullable(),
  lockedAt: z.string().nullable(),
  deleteAfter: z.string().nullable(),
  lastFailedAmountCents: z.number().int().nullable(),
  lastFailedReference: z.string().nullable(),
  lastFailedAt: z.string().nullable(),
  failureReason: z.string().nullable(),
});
export type FailedPayment = z.infer<typeof failedPaymentSchema>;

export const failedPaymentsResponseSchema = z.object({
  failedPayments: z.array(failedPaymentSchema),
});
export type FailedPaymentsResponse = z.infer<typeof failedPaymentsResponseSchema>;

export const taxViewQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type TaxViewQuery = z.infer<typeof taxViewQuerySchema>;

export const taxViewResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  grossCollectedCents: z.number().int(),
  vatCollectedCents: z.number().int(),
  taxableGrossCents: z.number().int(), // subscriptions (VAT-liable)
  nonTaxableGrossCents: z.number().int(), // credit purchases (not VAT-liable)
  netAfterVatCents: z.number().int(),
  refundsIssuedCount: z.number().int(),
  refundsIssuedCents: z.number().int(),
});
export type TaxViewResponse = z.infer<typeof taxViewResponseSchema>;

export const issueRefundRequestSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
export type IssueRefundRequest = z.infer<typeof issueRefundRequestSchema>;

// ---------- Affiliates (Tab 5) ----------

export const affiliateStatusValueSchema = z.enum(["active", "paused"]);
export type AffiliateStatusValue = z.infer<typeof affiliateStatusValueSchema>;

export const affiliatePerformanceSchema = z.object({
  signups: z.number().int(),
  trialsStarted: z.number().int(),
  conversions: z.number().int(),
  revenueAttributedCents: z.number().int(), // net-of-VAT subscription revenue from referred tenants
  commissionEarnedCents: z.number().int(),
});
export type AffiliatePerformance = z.infer<typeof affiliatePerformanceSchema>;

export const affiliateSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  code: z.string(),
  referralUrl: z.string(),
  commissionRateBps: z.number().int(),
  status: affiliateStatusValueSchema,
  createdAt: z.string(),
  // Lifetime performance + payout position (summary for the list).
  performance: affiliatePerformanceSchema,
  totalPaidCents: z.number().int(),
  commissionOwedCents: z.number().int(),
});
export type Affiliate = z.infer<typeof affiliateSchema>;

export const affiliatesResponseSchema = z.object({
  affiliates: z.array(affiliateSchema),
});
export type AffiliatesResponse = z.infer<typeof affiliatesResponseSchema>;

export const affiliatePayoutSchema = z.object({
  id: z.string(),
  amountCents: z.number().int(),
  note: z.string().nullable(),
  paidAt: z.string(),
});
export type AffiliatePayout = z.infer<typeof affiliatePayoutSchema>;

export const affiliateDetailSchema = affiliateSchema.extend({
  payouts: z.array(affiliatePayoutSchema),
});
export type AffiliateDetail = z.infer<typeof affiliateDetailSchema>;

export const createAffiliateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().email().optional(),
  // Percent (0–100); stored as basis points. Defaults to 10%.
  commissionRatePct: z.coerce.number().min(0).max(100).default(10),
});
export type CreateAffiliateRequest = z.infer<typeof createAffiliateSchema>;

export const updateAffiliateStatusRequestSchema = z.object({
  status: affiliateStatusValueSchema,
});
export type UpdateAffiliateStatusRequest = z.infer<typeof updateAffiliateStatusRequestSchema>;

export const recordAffiliatePayoutRequestSchema = z.object({
  amountCents: z.number().int().positive(),
  note: z.string().trim().max(500).optional(),
});
export type RecordAffiliatePayoutRequest = z.infer<typeof recordAffiliatePayoutRequestSchema>;

export const affiliatePerformanceQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type AffiliatePerformanceQuery = z.infer<typeof affiliatePerformanceQuerySchema>;

// ---------- Credits (Tab 4) ----------

export const creditTypeValueSchema = z.enum(["email", "whatsapp"]);
export type CreditTypeValue = z.infer<typeof creditTypeValueSchema>;

export const creditPricingSchema = z.object({
  creditType: creditTypeValueSchema,
  sellPriceCents: z.number().int(),
  providerCostCents: z.number().int(),
  updatedAt: z.string(),
});
export type CreditPricing = z.infer<typeof creditPricingSchema>;

export const creditPricingResponseSchema = z.object({
  pricing: z.array(creditPricingSchema),
});
export type CreditPricingResponse = z.infer<typeof creditPricingResponseSchema>;

export const setCreditPricingRequestSchema = z.object({
  creditType: creditTypeValueSchema,
  sellPriceCents: z.number().int().min(0),
  providerCostCents: z.number().int().min(0),
});
export type SetCreditPricingRequest = z.infer<typeof setCreditPricingRequestSchema>;

export const creditBundleSchema = z.object({
  id: z.string(),
  creditType: creditTypeValueSchema,
  name: z.string(),
  units: z.number().int(),
  priceCents: z.number().int(),
  isActive: z.boolean(),
  // Effective per-unit price, for at-a-glance comparison vs the base rate.
  perUnitCents: z.number(),
});
export type CreditBundle = z.infer<typeof creditBundleSchema>;

export const creditBundlesResponseSchema = z.object({
  bundles: z.array(creditBundleSchema),
});
export type CreditBundlesResponse = z.infer<typeof creditBundlesResponseSchema>;

export const createCreditBundleRequestSchema = z.object({
  creditType: creditTypeValueSchema,
  name: z.string().trim().min(1).max(120),
  units: z.number().int().positive(),
  priceCents: z.number().int().positive(),
});
export type CreateCreditBundleRequest = z.infer<typeof createCreditBundleRequestSchema>;

// Consumption — platform-wide totals per credit type, plus a per-tenant drill-in.
export const creditConsumptionRowSchema = z.object({
  creditType: creditTypeValueSchema,
  soldUnits: z.number().int(), // purchased
  grantedUnits: z.number().int(), // admin grants
  consumedUnits: z.number().int(),
  remainingUnits: z.number().int(),
});
export type CreditConsumptionRow = z.infer<typeof creditConsumptionRowSchema>;

export const tenantCreditConsumptionSchema = z.object({
  organizationId: z.string(),
  tenantName: z.string().nullable(),
  emailRemaining: z.number().int(),
  whatsappRemaining: z.number().int(),
  emailConsumed: z.number().int(),
  whatsappConsumed: z.number().int(),
});
export type TenantCreditConsumption = z.infer<typeof tenantCreditConsumptionSchema>;

export const creditConsumptionResponseSchema = z.object({
  totals: z.array(creditConsumptionRowSchema),
  tenants: z.array(tenantCreditConsumptionSchema),
});
export type CreditConsumptionResponse = z.infer<typeof creditConsumptionResponseSchema>;

// Margin — sell price vs provider cost per credit type, and realized total on
// sold credits.
export const creditMarginRowSchema = z.object({
  creditType: creditTypeValueSchema,
  sellPriceCents: z.number().int(),
  providerCostCents: z.number().int(),
  marginPerUnitCents: z.number().int(),
  soldUnits: z.number().int(),
  totalMarginCents: z.number().int(),
});
export type CreditMarginRow = z.infer<typeof creditMarginRowSchema>;

export const creditMarginResponseSchema = z.object({
  rows: z.array(creditMarginRowSchema),
  aggregateMarginCents: z.number().int(),
});
export type CreditMarginResponse = z.infer<typeof creditMarginResponseSchema>;

// ---------- Operations (Tab 6) ----------

// Announcements
export const announcementAudienceValueSchema = z.enum(["all", "tier", "tenant"]);
export type AnnouncementAudience = z.infer<typeof announcementAudienceValueSchema>;

export const createAnnouncementRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(5000),
    audience: announcementAudienceValueSchema,
    audienceValue: z.string().trim().min(1).max(200).optional(),
    sendEmail: z.boolean().default(false),
  })
  .refine((v) => v.audience === "all" || Boolean(v.audienceValue), {
    message: "audienceValue is required for tier or tenant audiences",
    path: ["audienceValue"],
  });
export type CreateAnnouncementRequest = z.infer<typeof createAnnouncementRequestSchema>;

export const announcementSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  audience: announcementAudienceValueSchema,
  audienceValue: z.string().nullable(),
  sendEmail: z.boolean(),
  recipientCount: z.number().int(),
  createdAt: z.string(),
});
export type Announcement = z.infer<typeof announcementSchema>;

export const announcementsResponseSchema = z.object({
  announcements: z.array(announcementSchema),
});
export type AnnouncementsResponse = z.infer<typeof announcementsResponseSchema>;

// Feature usage (platform-wide capability adoption)
export const featureAdoptionSchema = z.object({
  key: z.string(),
  label: z.string(),
  adopted: z.number().int(),
  rate: z.number(), // 0..1
});
export type FeatureAdoption = z.infer<typeof featureAdoptionSchema>;

export const featureUsageResponseSchema = z.object({
  totalTenants: z.number().int(),
  features: z.array(featureAdoptionSchema),
});
export type FeatureUsageResponse = z.infer<typeof featureUsageResponseSchema>;

// Churn analytics
export const churnQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type ChurnQuery = z.infer<typeof churnQuerySchema>;

export const labelCountSchema = z.object({ label: z.string(), count: z.number().int() });

export const churnAnalyticsResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  totalChurned: z.number().int(),
  byTier: z.array(labelCountSchema),
  byTenure: z.array(labelCountSchema),
  byReason: z.array(labelCountSchema),
  byExitType: z.array(labelCountSchema),
  hasSurveyData: z.boolean(),
});
export type ChurnAnalyticsResponse = z.infer<typeof churnAnalyticsResponseSchema>;

// Integration health
export const integrationHealthStatusSchema = z.enum(["healthy", "not_configured", "erroring"]);
export const integrationHealthItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  status: integrationHealthStatusSchema,
  recentErrors: z.number().int(),
});
export type IntegrationHealthItem = z.infer<typeof integrationHealthItemSchema>;

export const integrationHealthResponseSchema = z.object({
  integrations: z.array(integrationHealthItemSchema),
});
export type IntegrationHealthResponse = z.infer<typeof integrationHealthResponseSchema>;

// Audit log
export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  adminId: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  targetId: z.string().trim().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export const auditLogEntrySchema = z.object({
  id: z.string(),
  adminId: z.string().nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  details: z.unknown().nullable(),
  createdAt: z.string(),
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

export const auditLogResponseSchema = z.object({
  entries: z.array(auditLogEntrySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type AuditLogResponse = z.infer<typeof auditLogResponseSchema>;

// Error log
export const errorLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  source: z.string().trim().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type ErrorLogQuery = z.infer<typeof errorLogQuerySchema>;

export const errorLogEntrySchema = z.object({
  id: z.string(),
  source: z.string(),
  level: z.string(),
  message: z.string(),
  context: z.unknown().nullable(),
  createdAt: z.string(),
});
export type ErrorLogEntry = z.infer<typeof errorLogEntrySchema>;

export const errorLogResponseSchema = z.object({
  entries: z.array(errorLogEntrySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type ErrorLogResponse = z.infer<typeof errorLogResponseSchema>;

// ---------- Super Admin Overview (Tab 1) ----------
//
// Three stacked zones — headline metrics, revenue split, unit economics —
// plus a health roll-up. All figures are Numbatrak's own revenue/health
// (subscriptions + credits), never tenant shopper GMV. See
// platform-superadmin-plan.md §4 for the metric formulas and which are
// deferred to Phase B2 (CAC/payback, gated on ad-spend data).

export const overviewQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type OverviewQuery = z.infer<typeof overviewQuerySchema>;

export const healthStatusSchema = z.enum(["healthy", "warning", "critical", "unknown"]);
export type HealthStatusValue = z.infer<typeof healthStatusSchema>;

export const healthDimensionSchema = z.object({
  key: z.string(),
  status: healthStatusSchema,
  value: z.number().nullable(),
  message: z.string(),
});
export type HealthDimensionDto = z.infer<typeof healthDimensionSchema>;

export const overviewHealthSchema = z.object({
  overall: healthStatusSchema,
  isEmpty: z.boolean(),
  dimensions: z.array(healthDimensionSchema),
  alerts: z.array(z.string()),
});
export type OverviewHealth = z.infer<typeof overviewHealthSchema>;

export const signupSourceCountSchema = z.object({
  source: z.string(),
  count: z.number().int(),
});
export type SignupSourceCount = z.infer<typeof signupSourceCountSchema>;

// Zone 1 — headline metrics
export const overviewHeadlineSchema = z.object({
  mrrCents: z.number().int(),
  arrCents: z.number().int(),
  activeSubscriptions: z.number().int(),
  activeByTier: z.record(z.string(), z.number().int()),
  trialAccounts: z.number().int(),
  churnRatePct: z.number().nullable(),
  trialToPaidPct: z.number().nullable(),
  newSignups: z.number().int(),
  newSignupsBySource: z.array(signupSourceCountSchema),
  dau: z.number().int(),
  mau: z.number().int(),
  dauMauRatio: z.number().nullable(),
  uniqueActiveToday: z.number().int(),
  failedPayments: z.number().int(),
  dunningStages: z.object({ grace: z.number().int(), locked: z.number().int() }),
});
export type OverviewHeadline = z.infer<typeof overviewHeadlineSchema>;

// Zone 2 — revenue split (two streams, always separate)
const streamTotalsSchema = z.object({
  grossCents: z.number().int(),
  vatCents: z.number().int(),
  netCents: z.number().int(),
});
export const overviewRevenueSplitSchema = z.object({
  subscription: streamTotalsSchema.extend({
    byTier: z.record(z.string(), z.number().int()),
    monthlyGrossCents: z.number().int(),
    annualGrossCents: z.number().int(),
  }),
  credit: streamTotalsSchema.extend({
    emailGrossCents: z.number().int(),
    whatsappGrossCents: z.number().int(),
  }),
  combined: streamTotalsSchema,
});
export type OverviewRevenueSplit = z.infer<typeof overviewRevenueSplitSchema>;

// Zone 3 — unit economics (CAC/payback null until Phase B2)
export const overviewUnitEconomicsSchema = z.object({
  cacCents: z.number().nullable(),
  ltvCents: z.number().nullable(),
  ltvToCacRatio: z.number().nullable(),
  paybackMonths: z.number().nullable(),
  netRevenueRetentionPct: z.number().nullable(),
});
export type OverviewUnitEconomics = z.infer<typeof overviewUnitEconomicsSchema>;

export const overviewResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  headline: overviewHeadlineSchema,
  revenueSplit: overviewRevenueSplitSchema,
  unitEconomics: overviewUnitEconomicsSchema,
  health: overviewHealthSchema,
  // Honest flags about approximations or missing history (e.g. "churn needs a
  // prior snapshot", "CAC awaits ad-spend data").
  notes: z.array(z.string()),
});
export type OverviewResponse = z.infer<typeof overviewResponseSchema>;

// ---------- Overview trends (4/8/12-week toggle) ----------

export const overviewTrendsQuerySchema = z.object({
  metric: z.enum(["mrr", "churn", "conversion", "revenue"]).default("mrr"),
  weeks: z.coerce.number().int().refine((n) => [4, 8, 12].includes(n), "weeks must be 4, 8, or 12").default(12),
});
export type OverviewTrendsQuery = z.infer<typeof overviewTrendsQuerySchema>;

export const trendPointSchema = z.object({
  weekStart: z.string(),
  value: z.number(),
});
export type TrendPoint = z.infer<typeof trendPointSchema>;

export const overviewTrendsResponseSchema = z.object({
  metric: z.string(),
  weeks: z.number().int(),
  points: z.array(trendPointSchema),
});
export type OverviewTrendsResponse = z.infer<typeof overviewTrendsResponseSchema>;

// ---------- reserved subdomains ----------

export const reservedSubdomainSchema = z.object({
  word: z.string(),
  addedBy: z.string().nullable(),
  createdAt: z.string(),
});
export type ReservedSubdomain = z.infer<typeof reservedSubdomainSchema>;

export const addReservedSubdomainRequestSchema = z.object({
  word: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, "Invalid subdomain format"),
});
export type AddReservedSubdomainRequest = z.infer<typeof addReservedSubdomainRequestSchema>;

// ---------- feature flags ----------

export const featureFlagSchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
  description: z.string().nullable(),
  updatedAt: z.string(),
});
export type FeatureFlag = z.infer<typeof featureFlagSchema>;

export const updateFeatureFlagRequestSchema = z.object({
  enabled: z.boolean(),
  description: z.string().trim().max(500).optional(),
});
export type UpdateFeatureFlagRequest = z.infer<typeof updateFeatureFlagRequestSchema>;

// ---------- platform settings ----------

export const platformSettingSchema = z.object({
  key: z.string(),
  value: z.string().nullable(),
  updatedAt: z.string(),
});
export type PlatformSetting = z.infer<typeof platformSettingSchema>;

export const updatePlatformSettingRequestSchema = z.object({
  value: z.string().max(2000),
});
export type UpdatePlatformSettingRequest = z.infer<typeof updatePlatformSettingRequestSchema>;

// ---------- Business Metrics (Tab 7) ----------

export const expenseParentCategoryValueSchema = z.enum(["advertising", "marketing", "building", "operational"]);
export type ExpenseParentCategory = z.infer<typeof expenseParentCategoryValueSchema>;

export const expenseSubCategorySchema = z.object({
  id: z.string(),
  parentCategory: expenseParentCategoryValueSchema,
  name: z.string(),
});
export type ExpenseSubCategory = z.infer<typeof expenseSubCategorySchema>;

export const createExpenseSubCategoryRequestSchema = z.object({
  parentCategory: expenseParentCategoryValueSchema,
  name: z.string().trim().min(1).max(120),
});
export type CreateExpenseSubCategoryRequest = z.infer<typeof createExpenseSubCategoryRequestSchema>;

export const expenseSchema = z.object({
  id: z.string(),
  parentCategory: expenseParentCategoryValueSchema,
  subCategoryId: z.string().nullable(),
  subCategoryName: z.string().nullable(),
  description: z.string(),
  amountCents: z.number().int(),
  occurredAt: z.string(),
  createdAt: z.string(),
});
export type Expense = z.infer<typeof expenseSchema>;

export const createExpenseRequestSchema = z.object({
  parentCategory: expenseParentCategoryValueSchema,
  subCategoryId: z.string().optional(),
  description: z.string().trim().min(1).max(500),
  amountCents: z.number().int().positive(),
  occurredAt: z.string().datetime(),
});
export type CreateExpenseRequest = z.infer<typeof createExpenseRequestSchema>;

export const updateExpenseRequestSchema = z.object({
  parentCategory: expenseParentCategoryValueSchema.optional(),
  subCategoryId: z.string().nullable().optional(),
  description: z.string().trim().min(1).max(500).optional(),
  amountCents: z.number().int().positive().optional(),
  occurredAt: z.string().datetime().optional(),
});
export type UpdateExpenseRequest = z.infer<typeof updateExpenseRequestSchema>;

export const expensesQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  category: expenseParentCategoryValueSchema.optional(),
});
export type ExpensesQuery = z.infer<typeof expensesQuerySchema>;

export const expensesResponseSchema = z.object({
  expenses: z.array(expenseSchema),
  subCategories: z.array(expenseSubCategorySchema),
});
export type ExpensesResponse = z.infer<typeof expensesResponseSchema>;

// P&L
export const pnlCategoryRowSchema = z.object({
  parentCategory: expenseParentCategoryValueSchema,
  totalCents: z.number().int(),
  pctOfRevenue: z.number().nullable(),
});
export type PnlCategoryRow = z.infer<typeof pnlCategoryRowSchema>;

export const pnlResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  subscriptionRevenueCents: z.number().int(),
  creditMarginCents: z.number().int(),
  totalRevenueCents: z.number().int(),
  expensesByCategory: z.array(pnlCategoryRowSchema),
  totalExpensesCents: z.number().int(),
  netProfitCents: z.number().int(),
});
export type PnlResponse = z.infer<typeof pnlResponseSchema>;

// Ad performance
export const adPerformanceResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  totalAdSpendCents: z.number().int(),
  paidConversions: z.number().int(),
  cacCents: z.number().nullable(),
  actualLtvCents: z.number().nullable(),
  ltvToCacRatio: z.number().nullable(),
  paybackMonths: z.number().nullable(),
  isEarlyEstimate: z.boolean(),
});
export type AdPerformanceResponse = z.infer<typeof adPerformanceResponseSchema>;
