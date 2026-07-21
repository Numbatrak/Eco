import type { FastifyInstance } from "fastify";
import { addNumbatrakOrderUpsellRequestSchema } from "@platform/shared-types";
import { addOrderUpsellLine } from "../lib/orders.js";

export default async function addOrderUpsellRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { orderId: string } }>(
    "/org/numbatrak/orders/:orderId/upsell",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["update"] }) },
    async (request, reply) => {
      const body = addNumbatrakOrderUpsellRequestSchema.parse(request.body);
      const db = app.getDb();
      let order;
      try {
        order = await addOrderUpsellLine(db, request.activeOrganizationId!, request.params.orderId, body);
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "Add upsell failed" });
      }
      if (!order) {
        return reply.code(404).send({ error: "Order not found" });
      }
      return reply.send(order);
    },
  );
}
