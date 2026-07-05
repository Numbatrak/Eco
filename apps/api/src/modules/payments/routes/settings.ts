import type { FastifyInstance } from "fastify";
import { paymentSettingsRequestSchema } from "@platform/shared-types";
import {
  findPaymentSettings,
  serializePaymentSettings,
  upsertPaymentSettings,
} from "../lib/payment-settings-store.js";
import { verifyLiveModeReauth } from "../lib/live-mode-reauth.js";

export default async function paymentSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { tenantId: string } }>(
    "/tenants/:tenantId/payment-settings",
    { preHandler: [app.authenticate, app.requireTenantPermission("payments.manage")] },
    async (request, reply) => {
      const db = app.getDb();
      const row = await findPaymentSettings(db, request.params.tenantId);
      return reply.send(serializePaymentSettings(row));
    },
  );

  app.put<{ Params: { tenantId: string } }>(
    "/tenants/:tenantId/payment-settings",
    { preHandler: [app.authenticate, app.requireTenantPermission("payments.manage")] },
    async (request, reply) => {
      const body = paymentSettingsRequestSchema.parse(request.body);
      const db = app.getDb();

      if (body.mode === "live") {
        const reauth = await verifyLiveModeReauth(db, request.userId, body.password, body.code);
        if (!reauth.ok) {
          return reply.code(reauth.status).send({ error: reauth.error });
        }
      }

      await upsertPaymentSettings(db, request.params.tenantId, body);
      const row = await findPaymentSettings(db, request.params.tenantId);
      return reply.send(serializePaymentSettings(row));
    },
  );
}
