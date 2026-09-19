import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { updateNumbatrakOrderRequestSchema } from "@platform/shared-types";
import { auth } from "../../../lib/auth.js";
import { updateOrder } from "../lib/orders.js";

export default async function updateOrderRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { orderId: string } }>(
    "/org/numbatrak/orders/:orderId",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["update"] }) },
    async (request, reply) => {
      const body = updateNumbatrakOrderRequestSchema.parse(request.body);
      const db = app.getDb();
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      let order;
      try {
        order = await updateOrder(
          db,
          request.activeOrganizationId!,
          request.params.orderId,
          body,
          request.log,
          session?.user.id ?? null,
        );
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
