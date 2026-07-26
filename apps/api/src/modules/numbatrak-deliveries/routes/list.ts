import type { FastifyInstance } from "fastify";
import { listNumbatrakDeliveriesQuerySchema } from "@platform/shared-types";
import { listDeliveriesForOrg } from "../lib/deliveries.js";

export default async function listDeliveriesRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/deliveries",
    { preHandler: app.requireOrgPermission({ numbatrakDeliveries: ["view"] }) },
    async (request, reply) => {
      const query = listNumbatrakDeliveriesQuerySchema.parse(request.query);
      const db = app.getDb();
      const deliveries = await listDeliveriesForOrg(db, request.activeOrganizationId!, query);
      return reply.send({ deliveries });
    },
  );
}
