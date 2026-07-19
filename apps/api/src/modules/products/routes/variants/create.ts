import type { FastifyInstance } from "fastify";
import { createVariantRequestSchema } from "@platform/shared-types";
import { createVariant, serializeVariant } from "../../lib/variants.js";

export default async function createVariantRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { productId: string } }>(
    "/org/products/:productId/variants",
    { preHandler: app.requireOrgPermission({ products: ["edit"] }) },
    async (request, reply) => {
      const body = createVariantRequestSchema.parse(request.body);
      const db = app.getDb();
      const result = await createVariant(db, request.activeOrganizationId!, request.params.productId, body);
      if (!result.ok) {
        if (result.reason === "product_not_found") {
          return reply.code(404).send({ error: "Product not found" });
        }
        return reply.code(409).send({ error: "A variant with this size and color already exists" });
      }
      return reply.code(201).send(serializeVariant(result.variant));
    },
  );
}
