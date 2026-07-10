import type { FastifyInstance } from "fastify";
import { suspendTenant, tenantExists } from "../lib/tenant-admin.js";
import { logPlatformAdminAction } from "../lib/audit-log.js";

export default async function tenantSuspendRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { tenantId: string } }>(
    "/platform-admin/tenants/:tenantId/suspend",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const db = app.getDb();
      const { tenantId } = request.params;
      if (!(await tenantExists(db, tenantId))) {
        return reply.code(404).send({ error: "tenant_not_found" });
      }
      await suspendTenant(db, tenantId);
      await logPlatformAdminAction(db, {
        adminId: request.platformAdminId!,
        action: "tenant_suspended",
        targetType: "tenant",
        targetId: tenantId,
      });
      return reply.code(204).send();
    },
  );
}
