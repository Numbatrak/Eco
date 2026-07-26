import type { FastifyInstance } from "fastify";
import { createNumbatrakAbandonedCartRequestSchema } from "@platform/shared-types";
import { createCart, serializeCart } from "../lib/abandoned-carts.js";

export default async function createAbandonedCartRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/numbatrak/abandoned-carts",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["create"] }) },
    async (request, reply) => {
      const body = createNumbatrakAbandonedCartRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await createCart(db, request.activeOrganizationId!, body);
      return reply.code(201).send(serializeCart(row));
    },
  );
}
