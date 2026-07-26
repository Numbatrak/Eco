import type { FastifyInstance } from "fastify";
import { listNumbatrakStockMovementsQuerySchema } from "@platform/shared-types";
import { listMovements } from "../lib/movements.js";

export default async function listMovementsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/inventory/movements",
    { preHandler: app.requireOrgPermission({ numbatrakInventory: ["view"] }) },
    async (request, reply) => {
      const query = listNumbatrakStockMovementsQuerySchema.parse(request.query);
      const db = app.getDb();
      const movements = await listMovements(db, request.activeOrganizationId!, query);
      return reply.send({ movements });
    },
  );
}
