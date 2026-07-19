import type { FastifyInstance } from "fastify";
import { updateVariantRequestSchema } from "@platform/shared-types";
import { updateVariant, serializeVariant } from "../../lib/variants.js";

export default async function updateVariantRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { productId: string; variantId: string } }>(
    "/org/products/:productId/variants/:variantId",
    { preHandler: app.requireOrgPermission({ products: ["edit"] }) },
    async (request, reply) => {
      const body = updateVariantRequestSchema.parse(request.body);
      const db = app.getDb();
      const result = await updateVariant(
        db,
        request.activeOrganizationId!,
        request.params.productId,
        request.params.variantId,
        body,
      );
      if (!result.ok) {
        if (result.reason === "duplicate_variant") {
          return reply.code(409).send({ error: "A variant with this size and color already exists" });
        }
        return reply.code(404).send({ error: "Variant not found" });
      }
      return reply.send(serializeVariant(result.variant));
    },
  );
}
