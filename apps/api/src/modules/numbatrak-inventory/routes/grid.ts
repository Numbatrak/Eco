import type { FastifyInstance } from "fastify";
import { numbatrakStockGridQuerySchema } from "@platform/shared-types";
import { getStockGrid } from "../lib/movements.js";

export default async function stockGridRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/inventory/grid",
    { preHandler: app.requireOrgPermission({ numbatrakInventory: ["view"] }) },
    async (request, reply) => {
      const query = numbatrakStockGridQuerySchema.parse(request.query);
      const db = app.getDb();
      const { cells, costOfInventory } = await getStockGrid(db, request.activeOrganizationId!, query);
      return reply.send({ cells, costOfInventory });
    },
  );
}
