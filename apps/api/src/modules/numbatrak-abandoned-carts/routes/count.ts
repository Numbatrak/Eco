import type { FastifyInstance } from "fastify";
import { listNumbatrakAbandonedCartsQuerySchema } from "@platform/shared-types";
import { countCartsForOrg } from "../lib/abandoned-carts.js";

export default async function countAbandonedCartsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/abandoned-carts/count",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["view"] }) },
    async (request, reply) => {
      const query = listNumbatrakAbandonedCartsQuerySchema.partial().parse(request.query);
      const db = app.getDb();
      const count = await countCartsForOrg(db, request.activeOrganizationId!, query);
      return reply.send({ count });
    },
  );
}
