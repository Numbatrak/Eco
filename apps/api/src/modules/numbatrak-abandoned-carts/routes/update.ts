import type { FastifyInstance } from "fastify";
import { updateNumbatrakAbandonedCartRequestSchema } from "@platform/shared-types";
import { serializeCart, updateCart } from "../lib/abandoned-carts.js";

export default async function updateAbandonedCartRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { cartId: string } }>(
    "/org/numbatrak/abandoned-carts/:cartId",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["update"] }) },
    async (request, reply) => {
      const body = updateNumbatrakAbandonedCartRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await updateCart(db, request.activeOrganizationId!, request.params.cartId, body);
      if (!row) {
        return reply.code(404).send({ error: "Abandoned cart not found" });
      }
      return reply.send(serializeCart(row));
    },
  );
}
