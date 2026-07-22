import type { FastifyInstance } from "fastify";
import { updateNumbatrakFormRequestSchema } from "@platform/shared-types";
import { serializeForm, updateForm } from "../lib/forms.js";

export default async function updateFormRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { formId: string } }>(
    "/org/numbatrak/forms/:formId",
    { preHandler: app.requireOrgPermission({ numbatrakForms: ["update"] }) },
    async (request, reply) => {
      const body = updateNumbatrakFormRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await updateForm(db, request.activeOrganizationId!, request.params.formId, body);
      if (!row) {
        return reply.code(404).send({ error: "Form not found" });
      }
      return reply.send(serializeForm(row));
    },
  );
}
