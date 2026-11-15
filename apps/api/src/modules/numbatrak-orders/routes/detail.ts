import type { FastifyInstance } from "fastify";
import { attachRelations, findOrderForOrg } from "../lib/orders.js";

export default async function orderDetailRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { orderId: string } }>(
    "/org/numbatrak/orders/:orderId",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const order = await findOrderForOrg(db, organizationId, request.params.orderId);
      if (!order) return reply.status(404).send({ error: "Order not found" });
      const [full] = await attachRelations(db, [order]);
      return reply.send(full!);
    },
  );

  // Kept off the order list/detail payloads: it can be large and is only
  // opened on demand from the order.
  app.get<{ Params: { orderId: string } }>(
    "/org/numbatrak/orders/:orderId/submitted-details",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["view"] }) },
    async (request, reply) => {
      const order = await findOrderForOrg(app.getDb(), request.activeOrganizationId!, request.params.orderId);
      if (!order) return reply.status(404).send({ error: "Order not found" });
      return reply.send({ submittedData: order.submittedData ?? null });
    },
  );
}
