import type { FastifyInstance } from "fastify";
import { deleteProduct } from "../lib/products.js";

export default async function deleteProductRoutes(app: FastifyInstance): Promise<void> {
  app.delete<{ Params: { tenantId: string; productId: string } }>(
    "/tenants/:tenantId/products/:productId",
    { preHandler: [app.authenticate, app.requireTenantPermission("products.edit")] },
    async (request, reply) => {
      const db = app.getDb();
      const deleted = await deleteProduct(db, request.params.tenantId, request.params.productId);
      if (!deleted) {
        return reply.code(404).send({ error: "Product not found" });
      }
      return reply.code(204).send();
    },
  );
}
