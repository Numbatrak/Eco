import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { orderStatusValueSchema } from "@platform/shared-types";
import { updateOrderStatus } from "../lib/orders-admin.js";

const updateOrderStatusSchema = z.object({
  status: orderStatusValueSchema,
});

export default async function updateOrderStatusRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { orderId: string } }>(
    "/org/orders/:orderId/status",
    { preHandler: app.requireOrgPermission({ orders: ["manage"] }) },
    async (request, reply) => {
      const body = updateOrderStatusSchema.parse(request.body);
      const db = app.getDb();
      const result = await updateOrderStatus(
        db,
        request.activeOrganizationId!,
        request.params.orderId,
        body.status,
      );
      if (result === "not_found") {
        return reply.code(404).send({ error: "Order not found" });
      }
      if (result === "invalid_transition") {
        return reply.code(409).send({ error: "Invalid order status transition" });
      }
      return reply.code(204).send();
    },
  );
}
