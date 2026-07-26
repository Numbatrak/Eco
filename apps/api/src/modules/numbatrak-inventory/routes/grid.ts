import type { FastifyInstance } from "fastify";
import { getStockGrid } from "../lib/movements.js";

export default async function stockGridRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/inventory/grid",
    { preHandler: app.requireOrgPermission({ numbatrakInventory: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const cells = await getStockGrid(db, request.activeOrganizationId!);
      return reply.send({ cells });
    },
  );
}
