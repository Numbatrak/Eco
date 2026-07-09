import type { FastifyInstance } from "fastify";
import { createProductRequestSchema } from "@platform/shared-types";
import { createProduct, serializeProduct } from "../lib/products.js";

export default async function createProductRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/products",
    { preHandler: app.requireOrgPermission({ products: ["edit"] }) },
    async (request, reply) => {
      const body = createProductRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await createProduct(db, request.activeOrganizationId!, body);
      return reply.code(201).send(serializeProduct(row));
    },
  );
}
