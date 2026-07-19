import type { FastifyInstance } from "fastify";
import platformAdminLoginRoutes from "./login.js";
import tenantsListRoutes from "./tenants-list.js";
import tenantDetailRoutes from "./tenant-detail.js";
import tenantSuspendRoutes from "./tenant-suspend.js";
import tenantReactivateRoutes from "./tenant-reactivate.js";
import tenantPlanRoutes from "./tenant-plan.js";
import tenantCreditsGrantRoutes from "./tenant-credits-grant.js";
import tenantExtendTrialRoutes from "./tenant-extend-trial.js";
import tenantResetPasswordRoutes from "./tenant-reset-password.js";
import tenantDeleteRoutes from "./tenant-delete.js";
import overviewRoutes from "./overview.js";
import revenueRoutes from "./revenue.js";
import affiliateRoutes from "./affiliates.js";
import operationsRoutes from "./operations.js";
import reservedSubdomainsRoutes from "./reserved-subdomains.js";
import featureFlagsRoutes from "./feature-flags.js";
import platformSettingsRoutes from "./settings.js";
import creditsRoutes from "./credits.js";
import businessMetricsRoutes from "./business-metrics.js";

/**
 * Every route file registered here except login.ts sets
 * `{ preHandler: app.requirePlatformAdminAuth }` - that's the routing-layer
 * gate for the whole /platform-admin/* surface (see plugins/
 * platform-admin-access.ts). Do not add a route here that skips it.
 */
export default async function platformAdminRoutes(app: FastifyInstance): Promise<void> {
  await app.register(platformAdminLoginRoutes);
  await app.register(tenantsListRoutes);
  await app.register(tenantDetailRoutes);
  await app.register(tenantSuspendRoutes);
  await app.register(tenantReactivateRoutes);
  await app.register(tenantPlanRoutes);
  await app.register(tenantCreditsGrantRoutes);
  await app.register(tenantExtendTrialRoutes);
  await app.register(tenantResetPasswordRoutes);
  await app.register(tenantDeleteRoutes);
  await app.register(overviewRoutes);
  await app.register(revenueRoutes);
  await app.register(affiliateRoutes);
  await app.register(operationsRoutes);
  await app.register(reservedSubdomainsRoutes);
  await app.register(featureFlagsRoutes);
  await app.register(platformSettingsRoutes);
  await app.register(creditsRoutes);
  await app.register(businessMetricsRoutes);
}
