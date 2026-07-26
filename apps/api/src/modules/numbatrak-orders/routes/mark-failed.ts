import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { markFailedDeliveryRequestSchema } from "@platform/shared-types";
import { auth } from "../../../lib/auth.js";
import { markOrderFailedDelivery } from "../lib/orders.js";

export default async function markOrderFailedRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { orderId: string } }>(
    "/org/numbatrak/orders/:orderId/mark-failed",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["update"] }) },
    async (request, reply) => {
      const body = markFailedDeliveryRequestSchema.parse(request.body ?? {});
      const db = app.getDb();
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });

      let order;
      try {
        order = await markOrderFailedDelivery(db, request.activeOrganizationId!, request.params.orderId, {
          expenseAmount: body.expenseAmount,
          createdBy: session?.user.id ?? null,
        });
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "Mark-failed failed" });
      }
      if (!order) {
        return reply.code(404).send({ error: "Order not found" });
      }
      return reply.send(order);
    },
  );
}
