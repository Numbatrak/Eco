import type { FastifyInstance } from "fastify";
import { deleteOrder } from "../lib/orders.js";

export default async function deleteOrderRoutes(app: FastifyInstance): Promise<void> {
  app.delete<{ Params: { orderId: string } }>(
    "/org/numbatrak/orders/:orderId",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["delete"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const deleted = await deleteOrder(db, request.activeOrganizationId!, request.params.orderId);
      if (!deleted) {
        return reply.code(404).send({ error: "Order not found" });
      }
      return reply.code(204).send();
    },
  );
}
