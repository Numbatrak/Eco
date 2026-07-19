import type { FastifyInstance } from "fastify";
import { listVariantsForProduct, serializeVariant } from "../../lib/variants.js";

export default async function listVariantsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { productId: string } }>(
    "/org/products/:productId/variants",
    { preHandler: app.requireOrgPermission({ products: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const rows = await listVariantsForProduct(
        db,
        request.activeOrganizationId!,
        request.params.productId,
      );
      if (!rows) {
        return reply.code(404).send({ error: "Product not found" });
      }
      return reply.send({ variants: rows.map(serializeVariant) });
    },
  );
}
