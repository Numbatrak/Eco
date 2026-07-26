import type { FastifyInstance } from "fastify";
import { updateNumbatrakProductRequestSchema } from "@platform/shared-types";
import { serializeNumbatrakProduct, updateNumbatrakProduct } from "../lib/products.js";

export default async function updateNumbatrakProductRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { productId: string } }>(
    "/org/numbatrak/products/:productId",
    { preHandler: app.requireOrgPermission({ numbatrakProducts: ["update"] }) },
    async (request, reply) => {
      const body = updateNumbatrakProductRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await updateNumbatrakProduct(db, request.activeOrganizationId!, request.params.productId, body);
      if (!row) {
        return reply.code(404).send({ error: "Product not found" });
      }
      return reply.send(serializeNumbatrakProduct(row));
    },
  );
}
