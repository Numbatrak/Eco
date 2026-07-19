import type { FastifyInstance } from "fastify";
import platformPlansRoutes from "./plans.js";
import platformSubscriptionRoutes from "./subscriptions.js";
import platformBillingWebhookRoutes from "./webhooks.js";
import dunningCronRoutes from "./dunning-cron.js";
import metricsSnapshotCronRoutes from "./metrics-snapshot-cron.js";

/**
 * Platform's own billing module. Distinct from apps/api/src/modules/payments/
 * which handles TENANT payment settings (their Paystack/Flutterwave for
 * charging shoppers). This module is Platform charging its own tenants.
 *
 * Routes:
 *   GET  /platform-admin/billing/plans
 *   GET  /platform-admin/billing/plans/:planId
 *   GET  /platform-admin/tenants/:tenantId/billing
 *   POST /platform-admin/tenants/:tenantId/billing/subscription
 *   DEL  /platform-admin/tenants/:tenantId/billing/subscription
 *   POST /platform-billing/webhooks/paystack    (Platform's own Paystack)
 *   POST /platform-billing/cron/dunning-tick    (X-Cron-Secret protected)
 *   POST /platform-billing/cron/metrics-snapshot (X-Cron-Secret protected)
 *
 * The Super Admin Overview (Tab 1) HTTP surface lives in the platform-admin
 * module (/platform-admin/overview) but reads its metrics engine from
 * this module's lib/metrics/*.
 */
export default async function platformBillingRoutes(app: FastifyInstance): Promise<void> {
  await app.register(platformPlansRoutes);
  await app.register(platformSubscriptionRoutes);
  // Webhooks and cron run in a separate Fastify scope so their scoped
  // content-type parser (raw body for signature verification) doesn't
  // interfere with the JSON parsing of admin routes.
  await app.register(async (scope) => {
    await scope.register(platformBillingWebhookRoutes);
    await scope.register(dunningCronRoutes);
    await scope.register(metricsSnapshotCronRoutes);
  });
}
