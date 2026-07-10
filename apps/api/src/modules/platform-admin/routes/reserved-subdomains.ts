import type { FastifyInstance } from "fastify";
import { addReservedSubdomainRequestSchema } from "@platform/shared-types";
import {
  addReservedSubdomain,
  listReservedSubdomains,
  removeReservedSubdomain,
} from "../lib/reserved-subdomains-admin.js";
import { logPlatformAdminAction } from "../lib/audit-log.js";

export default async function reservedSubdomainsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/platform-admin/reserved-subdomains",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const db = app.getDb();
      return reply.send({ reservedSubdomains: await listReservedSubdomains(db) });
    },
  );

  app.post(
    "/platform-admin/reserved-subdomains",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const body = addReservedSubdomainRequestSchema.parse(request.body);
      const db = app.getDb();
      const adminId = request.platformAdminId!;
      const result = await addReservedSubdomain(db, { word: body.word, addedBy: adminId });
      if (result === "already_exists") {
        return reply.code(409).send({ error: "already_reserved" });
      }
      await logPlatformAdminAction(db, {
        adminId,
        action: "reserved_subdomain_added",
        targetType: "reserved_subdomain",
        targetId: body.word,
      });
      return reply.code(201).send(result);
    },
  );

  app.delete<{ Params: { word: string } }>(
    "/platform-admin/reserved-subdomains/:word",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const db = app.getDb();
      const word = request.params.word.toLowerCase();
      const removed = await removeReservedSubdomain(db, word);
      if (!removed) {
        return reply.code(404).send({ error: "not_found" });
      }
      await logPlatformAdminAction(db, {
        adminId: request.platformAdminId!,
        action: "reserved_subdomain_removed",
        targetType: "reserved_subdomain",
        targetId: word,
      });
      return reply.code(204).send();
    },
  );
}
