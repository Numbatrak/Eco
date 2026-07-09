import type { FastifyInstance } from "fastify";
import { deleteProduct } from "../lib/products.js";

export default async function deleteProductRoutes(app: FastifyInstance): Promise<void> {
  app.delete<{ Params: { productId: string } }>(
    "/org/products/:productId",
    { preHandler: app.requireOrgPermission({ products: ["edit"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const deleted = await deleteProduct(db, request.activeOrganizationId!, request.params.productId);
      if (!deleted) {
        return reply.code(404).send({ error: "Product not found" });
      }
      return reply.code(204).send();
    },
  );
}
