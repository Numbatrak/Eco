import type { FastifyInstance } from "fastify";
import { listOrdersForTenant } from "../lib/orders-admin.js";

export default async function listOrdersRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { tenantId: string } }>(
    "/tenants/:tenantId/orders",
    { preHandler: [app.authenticate, app.requireTenantPermission("orders.view")] },
    async (request, reply) => {
      const db = app.getDb();
      const list = await listOrdersForTenant(db, request.params.tenantId);
      return reply.send({ orders: list });
    },
  );
}
