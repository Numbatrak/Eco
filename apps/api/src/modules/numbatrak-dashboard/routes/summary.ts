import type { FastifyInstance } from "fastify";
import { dashboardScopeQuerySchema } from "@platform/shared-types";
import { fetchDashboardSummary } from "../lib/summary.js";

export default async function dashboardSummaryRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/dashboard/summary",
    { preHandler: app.requireOrgPermission({ numbatrakDashboard: ["view"] }) },
    async (request, reply) => {
      const query = dashboardScopeQuerySchema.parse(request.query);
      const db = app.getDb();
      const summary = await fetchDashboardSummary(db, request.activeOrganizationId!, query);
      return reply.send(summary);
    },
  );
}
