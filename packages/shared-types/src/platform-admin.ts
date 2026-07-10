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

// ---------- tenants: list/detail ----------

export const platformAdminTenantsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(200).optional(),
});
export type PlatformAdminTenantsQuery = z.infer<typeof platformAdminTenantsQuerySchema>;

export const platformAdminTenantSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  subdomain: z.string(),
  status: tenantStatusSchema,
  plan: z.string(),
  creditBalance: z.number().int(),
  orderCount: z.number().int(),
  revenueCents: z.number().int(),
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

export const creditAdjustmentSchema = z.object({
  id: z.string(),
  delta: z.number().int(),
  reason: z.string(),
  adminId: z.string().nullable(),
  createdAt: z.string(),
});
export type CreditAdjustment = z.infer<typeof creditAdjustmentSchema>;

export const platformAdminTenantDetailSchema = platformAdminTenantSummarySchema.extend({
  creditAdjustments: z.array(creditAdjustmentSchema),
});
export type PlatformAdminTenantDetail = z.infer<typeof platformAdminTenantDetailSchema>;

// ---------- tenant management ----------

export const updateTenantPlanRequestSchema = z.object({
  plan: z.string().trim().min(1).max(100),
});
export type UpdateTenantPlanRequest = z.infer<typeof updateTenantPlanRequestSchema>;

export const adjustTenantCreditsRequestSchema = z.object({
  delta: z.number().int(),
  reason: z.string().trim().min(1).max(500),
});
export type AdjustTenantCreditsRequest = z.infer<typeof adjustTenantCreditsRequestSchema>;

// ---------- metrics ----------

export const metricsOverviewQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type MetricsOverviewQuery = z.infer<typeof metricsOverviewQuerySchema>;

export const metricsOverviewResponseSchema = z.object({
  revenueCents: z.number().int(),
  orderCount: z.number().int(),
  activeTenantCount: z.number().int(),
  newTenantSignups: z.number().int(),
  from: z.string(),
  to: z.string(),
});
export type MetricsOverviewResponse = z.infer<typeof metricsOverviewResponseSchema>;

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
