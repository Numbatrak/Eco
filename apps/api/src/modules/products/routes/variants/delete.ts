import type { FastifyInstance } from "fastify";
import { deleteVariant } from "../../lib/variants.js";

export default async function deleteVariantRoutes(app: FastifyInstance): Promise<void> {
  app.delete<{ Params: { productId: string; variantId: string } }>(
    "/org/products/:productId/variants/:variantId",
    { preHandler: app.requireOrgPermission({ products: ["edit"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const deleted = await deleteVariant(
        db,
        request.activeOrganizationId!,
        request.params.productId,
        request.params.variantId,
      );
      if (!deleted) {
        return reply.code(404).send({ error: "Variant not found" });
      }
      return reply.code(204).send();
    },
  );
}
