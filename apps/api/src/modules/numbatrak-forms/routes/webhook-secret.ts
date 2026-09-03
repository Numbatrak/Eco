import type { FastifyInstance } from "fastify";
import { rotateFormWebhookSecret } from "../lib/forms.js";

export default async function formWebhookSecretRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { formId: string } }>(
    "/org/numbatrak/forms/:formId/webhook-secret/rotate",
    { preHandler: app.requireOrgPermission({ numbatrakForms: ["update"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const secret = await rotateFormWebhookSecret(db, request.activeOrganizationId!, request.params.formId);
      if (!secret) {
        return reply.code(404).send({ error: "Form not found" });
      }
      return reply.send({ secret });
    },
  );
}
