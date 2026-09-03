import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { createNumbatrakDeliveryRequestSchema } from "@platform/shared-types";
import { auth } from "../../../lib/auth.js";
import { createDelivery } from "../lib/deliveries.js";

export default async function createDeliveryRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/numbatrak/deliveries",
    { preHandler: app.requireOrgPermission({ numbatrakDeliveries: ["create"] }) },
    async (request, reply) => {
      const body = createNumbatrakDeliveryRequestSchema.parse(request.body);
      const db = app.getDb();
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      const delivery = await createDelivery(db, request.activeOrganizationId!, body, session?.user.id ?? null);
      return reply.code(201).send(delivery);
    },
  );
}
