import type { FastifyInstance } from "fastify";
import { grantTenantCreditsRequestSchema } from "@platform/shared-types";
import { grantTenantCredits, tenantExists } from "../lib/tenant-admin.js";
import { logPlatformAdminAction } from "../lib/audit-log.js";

/**
 * Grant credits to a specific pool (email / whatsapp) without payment. Writes
 * to the typed platform_credit_ledger (superseding the legacy single-pool
 * credit_adjustments). Amount, pool, and reason are all required — grants are
 * never silent, and every one is audit-logged.
 */
export default async function tenantCreditsGrantRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { tenantId: string } }>(
    "/platform-admin/tenants/:tenantId/credits/grant",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const body = grantTenantCreditsRequestSchema.parse(request.body);
      const db = app.getDb();
      const { tenantId } = request.params;
      if (!(await tenantExists(db, tenantId))) {
        return reply.code(404).send({ error: "tenant_not_found" });
      }
      const adminId = request.platformAdminId!;
      await grantTenantCredits(db, {
        tenantId,
        adminId,
        creditType: body.creditType,
        amount: body.amount,
        reason: body.reason,
      });
      await logPlatformAdminAction(db, {
        adminId,
        action: "tenant_credits_granted",
        targetType: "tenant",
        targetId: tenantId,
        details: { creditType: body.creditType, amount: body.amount, reason: body.reason },
      });
      return reply.code(204).send();
    },
  );
}
