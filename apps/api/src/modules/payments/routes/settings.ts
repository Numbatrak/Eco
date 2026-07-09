import type { FastifyInstance } from "fastify";
import { paymentSettingsRequestSchema } from "@platform/shared-types";
import { fromNodeHeaders } from "better-auth/node";
import {
  findPaymentSettings,
  serializePaymentSettings,
  upsertPaymentSettings,
} from "../lib/payment-settings-store.js";
import { verifyLiveModeReauth } from "../lib/live-mode-reauth.js";

export default async function paymentSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/payment-settings",
    { preHandler: app.requireOrgPermission({ payments: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const row = await findPaymentSettings(db, request.activeOrganizationId!);
      return reply.send(serializePaymentSettings(row));
    },
  );

  app.put(
    "/org/payment-settings",
    { preHandler: app.requireOrgPermission({ payments: ["manage"] }) },
    async (request, reply) => {
      const body = paymentSettingsRequestSchema.parse(request.body);
      const db = app.getDb();

      if (body.mode === "live") {
        const reauth = await verifyLiveModeReauth(
          fromNodeHeaders(request.headers),
          body.password,
          body.code,
        );
        if (!reauth.ok) {
          return reply.code(reauth.status).send({ error: reauth.error });
        }
      }

      await upsertPaymentSettings(db, request.activeOrganizationId!, body);
      const row = await findPaymentSettings(db, request.activeOrganizationId!);
      return reply.send(serializePaymentSettings(row));
    },
  );
}
