import type { FastifyInstance } from "fastify";
import { updateProductRequestSchema } from "@platform/shared-types";
import { updateProduct, serializeProduct } from "../lib/products.js";

export default async function updateProductRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { productId: string } }>(
    "/org/products/:productId",
    { preHandler: app.requireOrgPermission({ products: ["edit"] }) },
    async (request, reply) => {
      const body = updateProductRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await updateProduct(
        db,
        request.activeOrganizationId!,
        request.params.productId,
        body,
      );
      if (!row) {
        return reply.code(404).send({ error: "Product not found" });
      }
      return reply.send(serializeProduct(row));
    },
  );
}
