import type { FastifyInstance } from "fastify";
import { deleteCollection } from "../lib/collections.js";

export default async function deleteCollectionRoutes(app: FastifyInstance): Promise<void> {
  app.delete<{ Params: { collectionId: string } }>(
    "/org/collections/:collectionId",
    { preHandler: app.requireOrgPermission({ collections: ["edit"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const deleted = await deleteCollection(
        db,
        request.activeOrganizationId!,
        request.params.collectionId,
      );
      if (!deleted) {
        return reply.code(404).send({ error: "Collection not found" });
      }
      return reply.code(204).send();
    },
  );
}
