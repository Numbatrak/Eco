import type { FastifyInstance } from "fastify";
import { getTenantDetailForAdmin } from "../lib/tenant-admin.js";

export default async function tenantDetailRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { tenantId: string } }>(
    "/platform-admin/tenants/:tenantId",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const db = app.getDb();
      const detail = await getTenantDetailForAdmin(db, request.params.tenantId);
      if (!detail) {
        return reply.code(404).send({ error: "tenant_not_found" });
      }
      return reply.send(detail);
    },
  );
}
