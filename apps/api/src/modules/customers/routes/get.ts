import type { FastifyInstance } from "fastify";
import { findCustomerForTenant, serializeCustomer } from "../lib/customers.js";

export default async function getCustomerRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { customerId: string } }>(
    "/org/customers/:customerId",
    { preHandler: app.requireOrgPermission({ orders: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const customer = await findCustomerForTenant(
        db,
        request.activeOrganizationId!,
        request.params.customerId,
      );
      if (!customer) {
        return reply.code(404).send({ error: "Customer not found" });
      }
      return reply.send(serializeCustomer(customer));
    },
  );
}
