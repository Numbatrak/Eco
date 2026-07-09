import type { FastifyInstance } from "fastify";
import { listProductsForTenant, serializeProduct } from "../lib/products.js";

export default async function listProductsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/products",
    { preHandler: app.requireOrgPermission({ products: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const rows = await listProductsForTenant(db, request.activeOrganizationId!);
      return reply.send({ products: rows.map(serializeProduct) });
    },
  );
}
