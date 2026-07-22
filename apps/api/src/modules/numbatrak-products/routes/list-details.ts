import type { FastifyInstance } from "fastify";
import { listNumbatrakProductsWithDetailsForOrg } from "../lib/products.js";

export default async function listNumbatrakProductDetailsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/products/details",
    { preHandler: app.requireOrgPermission({ numbatrakProducts: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const products = await listNumbatrakProductsWithDetailsForOrg(db, request.activeOrganizationId!);
      return reply.send({ products });
    },
  );
}
