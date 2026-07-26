import type { FastifyInstance } from "fastify";
import { listFormsForOrg, serializeForm } from "../lib/forms.js";

export default async function listFormsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/forms",
    { preHandler: app.requireOrgPermission({ numbatrakForms: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const rows = await listFormsForOrg(db, request.activeOrganizationId!);
      return reply.send({ forms: rows.map(serializeForm) });
    },
  );
}
