import type { FastifyInstance } from "fastify";
import { updateCollectionRequestSchema } from "@platform/shared-types";
import { updateCollection, serializeCollection } from "../lib/collections.js";
import { isUniqueViolation } from "../../../lib/db-errors.js";

export default async function updateCollectionRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { collectionId: string } }>(
    "/org/collections/:collectionId",
    { preHandler: app.requireOrgPermission({ collections: ["edit"] }) },
    async (request, reply) => {
      const body = updateCollectionRequestSchema.parse(request.body);
      const db = app.getDb();
      try {
        const row = await updateCollection(
          db,
          request.activeOrganizationId!,
          request.params.collectionId,
          body,
        );
        if (!row) {
          return reply.code(404).send({ error: "Collection not found" });
        }
        return reply.send(serializeCollection(row));
      } catch (err) {
        if (isUniqueViolation(err)) {
          return reply.code(409).send({ error: "A collection with this slug already exists" });
        }
        throw err;
      }
    },
  );
}
