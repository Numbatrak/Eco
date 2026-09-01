import type { FastifyInstance } from "fastify";
import { numbatrakDeliveryAnalyticsQuerySchema } from "@platform/shared-types";
import { fetchDeliveryAnalyticsHeadline } from "../lib/delivery-analytics.js";

export default async function deliveryAnalyticsHeadlineRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/dashboard/delivery-analytics-headline",
    { preHandler: app.requireOrgPermission({ numbatrakDashboard: ["view"] }) },
    async (request, reply) => {
      const query = numbatrakDeliveryAnalyticsQuerySchema.parse(request.query);
      const db = app.getDb();
      const headline = await fetchDeliveryAnalyticsHeadline(db, request.activeOrganizationId!, query);
      return reply.send(headline);
    },
  );
}
