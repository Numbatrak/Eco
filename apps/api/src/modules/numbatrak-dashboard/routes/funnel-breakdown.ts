import type { FastifyInstance } from "fastify";
import { numbatrakFunnelBreakdownQuerySchema } from "@platform/shared-types";
import { fetchFunnelBreakdown } from "../lib/funnel-breakdown.js";

export default async function funnelBreakdownRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/dashboard/funnel-breakdown",
    { preHandler: app.requireOrgPermission({ numbatrakDashboard: ["view"] }) },
    async (request, reply) => {
      const query = numbatrakFunnelBreakdownQuerySchema.parse(request.query);
      const db = app.getDb();
      const rows = await fetchFunnelBreakdown(db, request.activeOrganizationId!, query);
      return reply.send({ rows });
    },
  );
}
