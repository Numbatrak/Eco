import type { FastifyInstance } from "fastify";
import { deleteTenantRequestSchema } from "@platform/shared-types";
import { deleteTenant, isTenantDeletable, tenantExists } from "../lib/tenant-admin.js";
import { logPlatformAdminAction } from "../lib/audit-log.js";

/**
 * Full tenant data wipe. Only permitted once the 90-day retention window has
 * expired (isTenantDeletable) and gated by an explicit `confirmation: "DELETE"`
 * token (the UI double-confirms). Irreversible. The revenue ledger survives
 * with organization_id nulled (see the platform_transactions FK).
 */
export default async function tenantDeleteRoutes(app: FastifyInstance): Promise<void> {
  app.delete<{ Params: { tenantId: string } }>(
    "/platform-admin/tenants/:tenantId",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const body = deleteTenantRequestSchema.parse(request.body);
      const db = app.getDb();
      const { tenantId } = request.params;
      if (!(await tenantExists(db, tenantId))) {
        return reply.code(404).send({ error: "tenant_not_found" });
      }
      if (!(await isTenantDeletable(db, tenantId))) {
        return reply.code(409).send({
          error: "retention_window_active",
          message: "Delete is only available after the 90-day retention window expires.",
        });
      }
      // Audit-log BEFORE the wipe — the tenant row (and its cascade) is about to
      // be gone, and the log must record who did it and why.
      await logPlatformAdminAction(db, {
        adminId: request.platformAdminId!,
        action: "tenant_deleted",
        targetType: "tenant",
        targetId: tenantId,
        details: { reason: body.reason },
      });
      await deleteTenant(db, tenantId);
      return reply.code(204).send();
    },
  );
}
