import type { FastifyInstance } from "fastify";
import { createNumbatrakProductVariantRequestSchema, updateNumbatrakProductVariantRequestSchema } from "@platform/shared-types";
import { createVariant, removeVariant, updateVariant } from "../lib/variants.js";
import { serializeVariant } from "../lib/products.js";

export default async function numbatrakProductVariantRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { productId: string } }>(
    "/org/numbatrak/products/:productId/variants",
    { preHandler: app.requireOrgPermission({ numbatrakProducts: ["update"] }) },
    async (request, reply) => {
      const body = createNumbatrakProductVariantRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await createVariant(db, request.activeOrganizationId!, request.params.productId, body);
      return reply.code(201).send(serializeVariant(row));
    },
  );

  app.patch<{ Params: { variantId: string } }>(
    "/org/numbatrak/product-variants/:variantId",
    { preHandler: app.requireOrgPermission({ numbatrakProducts: ["update"] }) },
    async (request, reply) => {
      const body = updateNumbatrakProductVariantRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await updateVariant(db, request.activeOrganizationId!, request.params.variantId, body);
      if (!row) {
        return reply.code(404).send({ error: "Variant not found" });
      }
      return reply.send(serializeVariant(row));
    },
  );

  app.delete<{ Params: { variantId: string } }>(
    "/org/numbatrak/product-variants/:variantId",
    { preHandler: app.requireOrgPermission({ numbatrakProducts: ["update"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const deleted = await removeVariant(db, request.activeOrganizationId!, request.params.variantId);
      if (!deleted) {
        return reply.code(404).send({ error: "Variant not found" });
      }
      return reply.code(204).send();
    },
  );
}
