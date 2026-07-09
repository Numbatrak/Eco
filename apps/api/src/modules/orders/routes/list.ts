import type { FastifyInstance } from "fastify";
import { listOrdersForTenant } from "../lib/orders-admin.js";

export default async function listOrdersRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/orders",
    { preHandler: app.requireOrgPermission({ orders: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const list = await listOrdersForTenant(db, request.activeOrganizationId!);
      return reply.send({ orders: list });
    },
  );
}
