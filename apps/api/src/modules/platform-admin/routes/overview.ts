import type { FastifyInstance } from "fastify";
import { overviewQuerySchema, overviewTrendsQuerySchema } from "@platform/shared-types";
import { getOverview } from "../../platform-billing/lib/metrics/overview-metrics.js";
import { getTrends } from "../../platform-billing/lib/metrics/trends.js";

/**
 * Super Admin Overview (Tab 1). Reads Numbatrak's own revenue/health from the
 * billing tables (platform_subscriptions + platform_transactions) — never
 * tenant shopper GMV. Computation lives in the platform-billing module; this
 * route is the Super-Admin-gated HTTP surface.
 */
export default async function overviewRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/platform-admin/overview",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const query = overviewQuerySchema.parse(request.query);
      const overview = await getOverview(app.getDb(), query);
      // Minimal alert sink until the Notifications layer lands (G5): surface
      // critical health to the server log so a founder alert can hang off it.
      if (overview.health.overall === "critical") {
        app.log.warn({ alerts: overview.health.alerts }, "platform-overview: CRITICAL health state");
      }
      return reply.send(overview);
    },
  );

  app.get(
    "/platform-admin/overview/trends",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const { metric, weeks } = overviewTrendsQuerySchema.parse(request.query);
      const trends = await getTrends(app.getDb(), metric, weeks, new Date());
      return reply.send(trends);
    },
  );
}
