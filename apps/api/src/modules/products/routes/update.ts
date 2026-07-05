import type { FastifyInstance } from "fastify";
import { updateProductRequestSchema } from "@platform/shared-types";
import { updateProduct, serializeProduct } from "../lib/products.js";

export default async function updateProductRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { tenantId: string; productId: string } }>(
    "/tenants/:tenantId/products/:productId",
    { preHandler: [app.authenticate, app.requireTenantPermission("products.edit")] },
    async (request, reply) => {
      const body = updateProductRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await updateProduct(db, request.params.tenantId, request.params.productId, body);
      if (!row) {
        return reply.code(404).send({ error: "Product not found" });
      }
      return reply.send(serializeProduct(row));
    },
  );
}
