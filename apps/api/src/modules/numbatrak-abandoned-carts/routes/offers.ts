import type { FastifyInstance } from "fastify";
import { listDistinctOffers } from "../lib/abandoned-carts.js";

export default async function abandonedCartOffersRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/abandoned-carts/offers",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const offers = await listDistinctOffers(db, request.activeOrganizationId!);
      return reply.send({ offers });
    },
  );
}
