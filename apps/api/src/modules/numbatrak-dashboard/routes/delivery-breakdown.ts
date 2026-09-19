import type { FastifyInstance } from "fastify";
import { numbatrakDeliveryBreakdownQuerySchema } from "@platform/shared-types";
import {
  fetchDeliveryBreakdownByAgent,
  fetchDeliveryBreakdownByCsr,
  fetchDeliveryBreakdownByLocation,
  fetchDeliveryBreakdownByProduct,
} from "../lib/delivery-analytics.js";

export default async function deliveryBreakdownRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/dashboard/delivery-breakdown",
    { preHandler: app.requireOrgPermission({ numbatrakDashboard: ["view"] }) },
    async (request, reply) => {
      const query = numbatrakDeliveryBreakdownQuerySchema.parse(request.query);
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const rows =
        query.groupBy === "agent"
          ? await fetchDeliveryBreakdownByAgent(db, organizationId, query)
          : query.groupBy === "product"
            ? await fetchDeliveryBreakdownByProduct(db, organizationId, query)
            : query.groupBy === "csr"
              ? await fetchDeliveryBreakdownByCsr(db, organizationId, query)
              : await fetchDeliveryBreakdownByLocation(db, organizationId, query);
      return reply.send({ rows });
    },
  );
}
