import type { FastifyInstance } from "fastify";
import { createCollectionRequestSchema } from "@platform/shared-types";
import { createCollection, serializeCollection } from "../lib/collections.js";
import { isUniqueViolation } from "../../../lib/db-errors.js";

export default async function createCollectionRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/collections",
    { preHandler: app.requireOrgPermission({ collections: ["edit"] }) },
    async (request, reply) => {
      const body = createCollectionRequestSchema.parse(request.body);
      const db = app.getDb();
      try {
        const row = await createCollection(db, request.activeOrganizationId!, body);
        return reply.code(201).send(serializeCollection(row));
      } catch (err) {
        if (isUniqueViolation(err)) {
          return reply.code(409).send({ error: "A collection with this slug already exists" });
        }
        throw err;
      }
    },
  );
}
