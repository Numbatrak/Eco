import type { FastifyInstance } from "fastify";
import { listNumbatrakProductsForOrg, serializeNumbatrakProduct } from "../lib/products.js";

export default async function listNumbatrakProductsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/products",
    { preHandler: app.requireOrgPermission({ numbatrakProducts: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const rows = await listNumbatrakProductsForOrg(db, request.activeOrganizationId!);
      return reply.send({ products: rows.map(serializeNumbatrakProduct) });
    },
  );
}
