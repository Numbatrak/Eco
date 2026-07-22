import type { FastifyInstance } from "fastify";
import { convertCartToOrder } from "../lib/convert.js";

export default async function convertAbandonedCartRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { cartId: string } }>(
    "/org/numbatrak/abandoned-carts/:cartId/convert",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["update"] }) },
    async (request, reply) => {
      const db = app.getDb();
      let order;
      try {
        order = await convertCartToOrder(db, request.activeOrganizationId!, request.params.cartId);
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "Conversion failed" });
      }
      return reply.send(order);
    },
  );
}
