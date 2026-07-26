import type { FastifyInstance } from "fastify";
import { removeCart } from "../lib/abandoned-carts.js";

export default async function deleteAbandonedCartRoutes(app: FastifyInstance): Promise<void> {
  app.delete<{ Params: { cartId: string } }>(
    "/org/numbatrak/abandoned-carts/:cartId",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["delete"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const deleted = await removeCart(db, request.activeOrganizationId!, request.params.cartId);
      if (!deleted) {
        return reply.code(404).send({ error: "Abandoned cart not found" });
      }
      return reply.code(204).send();
    },
  );
}
