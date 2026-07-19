import type { FastifyInstance } from "fastify";
import { extendTrialRequestSchema } from "@platform/shared-types";
import { extendTrial, tenantExists } from "../lib/tenant-admin.js";
import { logPlatformAdminAction } from "../lib/audit-log.js";

export default async function tenantExtendTrialRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { tenantId: string } }>(
    "/platform-admin/tenants/:tenantId/trial/extend",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const body = extendTrialRequestSchema.parse(request.body);
      const db = app.getDb();
      const { tenantId } = request.params;
      if (!(await tenantExists(db, tenantId))) {
        return reply.code(404).send({ error: "tenant_not_found" });
      }
      const extended = await extendTrial(db, tenantId, body.days);
      if (!extended) {
        return reply.code(409).send({ error: "no_subscription_to_extend" });
      }
      await logPlatformAdminAction(db, {
        adminId: request.platformAdminId!,
        action: "tenant_trial_extended",
        targetType: "tenant",
        targetId: tenantId,
        details: { days: body.days, reason: body.reason },
      });
      return reply.code(204).send();
    },
  );
}
