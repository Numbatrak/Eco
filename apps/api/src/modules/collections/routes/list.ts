import type { FastifyInstance } from "fastify";
import { listCollectionsForTenant, serializeCollection } from "../lib/collections.js";

export default async function listCollectionsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/collections",
    { preHandler: app.requireOrgPermission({ collections: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const rows = await listCollectionsForTenant(db, request.activeOrganizationId!);
      return reply.send({ collections: rows.map(serializeCollection) });
    },
  );
}
