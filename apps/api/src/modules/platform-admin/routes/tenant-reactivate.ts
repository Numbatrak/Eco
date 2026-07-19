import type { FastifyInstance } from "fastify";
import { reactivateTenant, tenantExists } from "../lib/tenant-admin.js";
import { logPlatformAdminAction } from "../lib/audit-log.js";

export default async function tenantReactivateRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { tenantId: string } }>(
    "/platform-admin/tenants/:tenantId/reactivate",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const db = app.getDb();
      const { tenantId } = request.params;
      if (!(await tenantExists(db, tenantId))) {
        return reply.code(404).send({ error: "tenant_not_found" });
      }
      await reactivateTenant(db, tenantId);
      await logPlatformAdminAction(db, {
        adminId: request.platformAdminId!,
        action: "tenant_reactivated",
        targetType: "tenant",
        targetId: tenantId,
      });
      return reply.code(204).send();
    },
  );
}
