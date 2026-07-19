import type { FastifyInstance } from "fastify";
import { auth } from "../../../lib/auth.js";
import { getOwnerEmail, tenantExists } from "../lib/tenant-admin.js";
import { logPlatformAdminAction } from "../lib/audit-log.js";

/**
 * Triggers a password reset for a tenant's owner. Uses the TENANT auth
 * instance's requestPasswordReset (which emails a reset link to the storefront
 * dashboard) — never the platform-admin auth instance. There is no
 * set-password-directly path; the owner completes the reset themselves.
 */
export default async function tenantResetPasswordRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { tenantId: string } }>(
    "/platform-admin/tenants/:tenantId/reset-password",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const db = app.getDb();
      const { tenantId } = request.params;
      if (!(await tenantExists(db, tenantId))) {
        return reply.code(404).send({ error: "tenant_not_found" });
      }
      const email = await getOwnerEmail(db, tenantId);
      if (!email) {
        return reply.code(409).send({ error: "no_owner_found" });
      }
      await auth.api.requestPasswordReset({ body: { email } });
      await logPlatformAdminAction(db, {
        adminId: request.platformAdminId!,
        action: "tenant_password_reset_triggered",
        targetType: "tenant",
        targetId: tenantId,
        details: { email },
      });
      return reply.code(202).send({ message: "Password reset email sent to the tenant owner." });
    },
  );
}
