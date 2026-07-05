import type { FastifyInstance } from "fastify";
import { findOrderDetailForTenant } from "../lib/orders-admin.js";

export default async function orderDetailRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { tenantId: string; orderId: string } }>(
    "/tenants/:tenantId/orders/:orderId",
    { preHandler: [app.authenticate, app.requireTenantPermission("orders.view")] },
    async (request, reply) => {
      const db = app.getDb();
      const order = await findOrderDetailForTenant(db, request.params.tenantId, request.params.orderId);
      if (!order) {
        return reply.code(404).send({ error: "Order not found" });
      }
      return reply.send(order);
    },
  );
}
