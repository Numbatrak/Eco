import type { FastifyInstance } from "fastify";
import { createNumbatrakDeliveryRequestSchema } from "@platform/shared-types";
import { createDelivery } from "../lib/deliveries.js";

export default async function createDeliveryRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/numbatrak/deliveries",
    { preHandler: app.requireOrgPermission({ numbatrakDeliveries: ["create"] }) },
    async (request, reply) => {
      const body = createNumbatrakDeliveryRequestSchema.parse(request.body);
      const db = app.getDb();
      const delivery = await createDelivery(db, request.activeOrganizationId!, body);
      return reply.code(201).send(delivery);
    },
  );
}
