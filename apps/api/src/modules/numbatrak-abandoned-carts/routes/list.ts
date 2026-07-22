import type { FastifyInstance } from "fastify";
import { listNumbatrakAbandonedCartsQuerySchema } from "@platform/shared-types";
import { listCartsForOrg, serializeCart } from "../lib/abandoned-carts.js";

export default async function listAbandonedCartsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/abandoned-carts",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["view"] }) },
    async (request, reply) => {
      const query = listNumbatrakAbandonedCartsQuerySchema.parse(request.query);
      const db = app.getDb();
      const rows = await listCartsForOrg(db, request.activeOrganizationId!, query);
      return reply.send({ carts: rows.map(serializeCart) });
    },
  );
}
