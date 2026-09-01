import type { FastifyInstance } from "fastify";
import { numbatrakDeliveryStatusSchema } from "@platform/shared-types";
import { z } from "zod";
import { fetchDeliveryRateByLocation } from "../lib/delivery-rate.js";

const querySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  // Only sent by the Delivery Analytics page (DeliveryRateByLocationComponent
  // with analyticsFilters) - the plain Dashboard widget never sets these.
  agentId: z.coerce.number().int().optional(),
  productId: z.string().uuid().optional(),
  status: numbatrakDeliveryStatusSchema.optional(),
  subBrand: z.string().optional(),
});

export default async function deliveryRateByLocationRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/dashboard/delivery-rate-by-location",
    { preHandler: app.requireOrgPermission({ numbatrakDashboard: ["view"] }) },
    async (request, reply) => {
      const query = querySchema.parse(request.query);
      const db = app.getDb();
      const rates = await fetchDeliveryRateByLocation(db, request.activeOrganizationId!, query.dateFrom, query.dateTo, {
        agentId: query.agentId,
        productId: query.productId,
        status: query.status,
        subBrand: query.subBrand,
      });
      return reply.send({ rates });
    },
  );
}
