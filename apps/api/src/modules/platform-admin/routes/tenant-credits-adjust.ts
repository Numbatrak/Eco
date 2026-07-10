import type { FastifyInstance } from "fastify";
import { adjustTenantCreditsRequestSchema } from "@platform/shared-types";
import { adjustTenantCredits, tenantExists } from "../lib/tenant-admin.js";
import { logPlatformAdminAction } from "../lib/audit-log.js";

export default async function tenantCreditsAdjustRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { tenantId: string } }>(
    "/platform-admin/tenants/:tenantId/credits/adjust",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      // `reason` is required by this schema (not optional) - credit
      // adjustments are never silent.
      const body = adjustTenantCreditsRequestSchema.parse(request.body);
      const db = app.getDb();
      const { tenantId } = request.params;
      if (!(await tenantExists(db, tenantId))) {
        return reply.code(404).send({ error: "tenant_not_found" });
      }
      const adminId = request.platformAdminId!;
      await adjustTenantCredits(db, { tenantId, adminId, delta: body.delta, reason: body.reason });
      await logPlatformAdminAction(db, {
        adminId,
        action: "tenant_credits_adjusted",
        targetType: "tenant",
        targetId: tenantId,
        details: { delta: body.delta, reason: body.reason },
      });
      return reply.code(204).send();
    },
  );
}
