import type { FastifyInstance } from "fastify";
import { findCollectionForTenant, serializeCollection } from "../lib/collections.js";

export default async function getCollectionRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { collectionId: string } }>(
    "/org/collections/:collectionId",
    { preHandler: app.requireOrgPermission({ collections: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const collection = await findCollectionForTenant(
        db,
        request.activeOrganizationId!,
        request.params.collectionId,
      );
      if (!collection) {
        return reply.code(404).send({ error: "Collection not found" });
      }
      return reply.send(serializeCollection(collection));
    },
  );
}
