import type { FastifyInstance } from "fastify";
import { metricsOverviewQuerySchema } from "@platform/shared-types";
import { getOverviewMetrics } from "../lib/metrics.js";

export default async function metricsOverviewRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/platform-admin/metrics/overview",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const query = metricsOverviewQuerySchema.parse(request.query);
      const db = app.getDb();
      const metrics = await getOverviewMetrics(db, query);
      return reply.send(metrics);
    },
  );
}
