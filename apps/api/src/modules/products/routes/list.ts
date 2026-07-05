import type { FastifyInstance } from "fastify";
import { listProductsForTenant, serializeProduct } from "../lib/products.js";

export default async function listProductsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { tenantId: string } }>(
    "/tenants/:tenantId/products",
    { preHandler: [app.authenticate, app.requireTenantPermission("products.view")] },
    async (request, reply) => {
      const db = app.getDb();
      const rows = await listProductsForTenant(db, request.params.tenantId);
      return reply.send({ products: rows.map(serializeProduct) });
    },
  );
}
