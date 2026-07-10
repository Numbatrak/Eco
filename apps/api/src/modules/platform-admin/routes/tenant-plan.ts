import type { FastifyInstance } from "fastify";
import { updateTenantPlanRequestSchema } from "@platform/shared-types";
import { tenantExists, updateTenantPlan } from "../lib/tenant-admin.js";
import { logPlatformAdminAction } from "../lib/audit-log.js";

export default async function tenantPlanRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { tenantId: string } }>(
    "/platform-admin/tenants/:tenantId/plan",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const body = updateTenantPlanRequestSchema.parse(request.body);
      const db = app.getDb();
      const { tenantId } = request.params;
      if (!(await tenantExists(db, tenantId))) {
        return reply.code(404).send({ error: "tenant_not_found" });
      }
      await updateTenantPlan(db, tenantId, body.plan);
      await logPlatformAdminAction(db, {
        adminId: request.platformAdminId!,
        action: "tenant_plan_updated",
        targetType: "tenant",
        targetId: tenantId,
        details: { plan: body.plan },
      });
      return reply.code(204).send();
    },
  );
}
