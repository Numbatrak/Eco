import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../../lib/auth.js";
import { advanceOrderStatus } from "../lib/orders.js";

export default async function advanceOrderStatusRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { orderId: string } }>(
    "/org/numbatrak/orders/:orderId/advance-status",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["update"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      let order;
      try {
        order = await advanceOrderStatus(
          db,
          request.activeOrganizationId!,
          request.params.orderId,
          request.log,
          session?.user.id ?? null,
        );
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "Advance failed" });
      }
      if (!order) {
        return reply.code(404).send({ error: "Order not found" });
      }
      return reply.send(order);
    },
  );
}
