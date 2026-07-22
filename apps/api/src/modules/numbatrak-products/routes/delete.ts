import type { FastifyInstance } from "fastify";
import { removeNumbatrakProduct } from "../lib/products.js";

export default async function deleteNumbatrakProductRoutes(app: FastifyInstance): Promise<void> {
  app.delete<{ Params: { productId: string } }>(
    "/org/numbatrak/products/:productId",
    { preHandler: app.requireOrgPermission({ numbatrakProducts: ["delete"] }) },
    async (request, reply) => {
      const db = app.getDb();
      let deleted: boolean;
      try {
        deleted = await removeNumbatrakProduct(db, request.activeOrganizationId!, request.params.productId);
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "Delete failed" });
      }
      if (!deleted) {
        return reply.code(404).send({ error: "Product not found" });
      }
      return reply.code(204).send();
    },
  );
}
