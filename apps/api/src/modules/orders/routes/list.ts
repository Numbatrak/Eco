import type { FastifyInstance } from "fastify";
import { listOrdersForTenant } from "../lib/orders-admin.js";

export default async function listOrdersRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { customerId?: string } }>(
    "/org/orders",
    { preHandler: app.requireOrgPermission({ orders: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const list = await listOrdersForTenant(
        db,
        request.activeOrganizationId!,
        request.query.customerId,
      );
      return reply.send({ orders: list });
    },
  );
}
