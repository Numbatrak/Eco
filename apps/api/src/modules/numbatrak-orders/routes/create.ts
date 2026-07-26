import type { FastifyInstance } from "fastify";
import { createNumbatrakOrderRequestSchema } from "@platform/shared-types";
import { createManualOrder } from "../lib/orders.js";

export default async function createOrderRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/numbatrak/orders",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["create"] }) },
    async (request, reply) => {
      const body = createNumbatrakOrderRequestSchema.parse(request.body);
      const db = app.getDb();
      const order = await createManualOrder(db, request.activeOrganizationId!, body);
      return reply.code(201).send(order);
    },
  );
}
