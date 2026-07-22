import type { FastifyInstance } from "fastify";
import { createNumbatrakProductRequestSchema } from "@platform/shared-types";
import { createNumbatrakProduct, serializeNumbatrakProduct } from "../lib/products.js";

export default async function createNumbatrakProductRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/numbatrak/products",
    { preHandler: app.requireOrgPermission({ numbatrakProducts: ["create"] }) },
    async (request, reply) => {
      const body = createNumbatrakProductRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await createNumbatrakProduct(db, request.activeOrganizationId!, body);
      return reply.code(201).send(serializeNumbatrakProduct(row));
    },
  );
}
