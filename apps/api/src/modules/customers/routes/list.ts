import type { FastifyInstance } from "fastify";
import { listCustomersForTenant, serializeCustomer } from "../lib/customers.js";

export default async function listCustomersRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/customers",
    { preHandler: app.requireOrgPermission({ orders: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const rows = await listCustomersForTenant(db, request.activeOrganizationId!);
      return reply.send({ customers: rows.map(serializeCustomer) });
    },
  );
}
