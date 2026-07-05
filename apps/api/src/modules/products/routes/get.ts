import type { FastifyInstance } from "fastify";
import { findProductForTenant, serializeProduct } from "../lib/products.js";

export default async function getProductRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { tenantId: string; productId: string } }>(
    "/tenants/:tenantId/products/:productId",
    { preHandler: [app.authenticate, app.requireTenantPermission("products.view")] },
    async (request, reply) => {
      const db = app.getDb();
      const product = await findProductForTenant(db, request.params.tenantId, request.params.productId);
      if (!product) {
        return reply.code(404).send({ error: "Product not found" });
      }
      return reply.send(serializeProduct(product));
    },
  );
}
