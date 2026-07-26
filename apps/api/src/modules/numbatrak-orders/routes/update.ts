import type { FastifyInstance } from "fastify";
import { updateNumbatrakOrderRequestSchema } from "@platform/shared-types";
import { updateOrder } from "../lib/orders.js";

export default async function updateOrderRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { orderId: string } }>(
    "/org/numbatrak/orders/:orderId",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["update"] }) },
    async (request, reply) => {
      const body = updateNumbatrakOrderRequestSchema.parse(request.body);
      const db = app.getDb();
      let order;
      try {
        order = await updateOrder(db, request.activeOrganizationId!, request.params.orderId, body);
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "Update failed" });
      }
      if (!order) {
        return reply.code(404).send({ error: "Order not found" });
      }
      return reply.send(order);
    },
  );
}
