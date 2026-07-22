import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { fetchDeliveryRateByLocation } from "../lib/delivery-rate.js";

const querySchema = z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional() });

export default async function deliveryRateByLocationRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/dashboard/delivery-rate-by-location",
    { preHandler: app.requireOrgPermission({ numbatrakDashboard: ["view"] }) },
    async (request, reply) => {
      const query = querySchema.parse(request.query);
      const db = app.getDb();
      const rates = await fetchDeliveryRateByLocation(db, request.activeOrganizationId!, query.dateFrom, query.dateTo);
      return reply.send({ rates });
    },
  );
}
