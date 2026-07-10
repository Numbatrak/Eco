import type { FastifyInstance } from "fastify";
import platformAdminLoginRoutes from "./login.js";
import tenantsListRoutes from "./tenants-list.js";
import tenantDetailRoutes from "./tenant-detail.js";
import tenantSuspendRoutes from "./tenant-suspend.js";
import tenantReactivateRoutes from "./tenant-reactivate.js";
import tenantPlanRoutes from "./tenant-plan.js";
import tenantCreditsAdjustRoutes from "./tenant-credits-adjust.js";
import metricsOverviewRoutes from "./metrics-overview.js";
import reservedSubdomainsRoutes from "./reserved-subdomains.js";
import featureFlagsRoutes from "./feature-flags.js";
import platformSettingsRoutes from "./settings.js";

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
  await app.register(tenantCreditsAdjustRoutes);
  await app.register(metricsOverviewRoutes);
  await app.register(reservedSubdomainsRoutes);
  await app.register(featureFlagsRoutes);
  await app.register(platformSettingsRoutes);
}
