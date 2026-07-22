import type { FastifyInstance } from "fastify";
import { listDistinctFunnels } from "../lib/abandoned-carts.js";

export default async function abandonedCartFunnelsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/abandoned-carts/funnels",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const funnels = await listDistinctFunnels(db, request.activeOrganizationId!);
      return reply.send({ funnels });
    },
  );
}
