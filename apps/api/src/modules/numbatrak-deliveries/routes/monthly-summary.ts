import type { FastifyInstance } from "fastify";
import { monthlyDeliverySummaryQuerySchema } from "@platform/shared-types";
import { fetchMonthlySummary } from "../lib/deliveries.js";

export default async function monthlySummaryRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/deliveries/monthly-summary",
    { preHandler: app.requireOrgPermission({ numbatrakDeliveries: ["view"] }) },
    async (request, reply) => {
      const query = monthlyDeliverySummaryQuerySchema.parse(request.query);
      const db = app.getDb();
      const summary = await fetchMonthlySummary(db, request.activeOrganizationId!, query);
      return reply.send({ summary });
    },
  );
}
