import type { FastifyInstance } from "fastify";
import { removeForm } from "../lib/forms.js";

export default async function deleteFormRoutes(app: FastifyInstance): Promise<void> {
  app.delete<{ Params: { formId: string } }>(
    "/org/numbatrak/forms/:formId",
    { preHandler: app.requireOrgPermission({ numbatrakForms: ["delete"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const deleted = await removeForm(db, request.activeOrganizationId!, request.params.formId);
      if (!deleted) {
        return reply.code(404).send({ error: "Form not found" });
      }
      return reply.code(204).send();
    },
  );
}
