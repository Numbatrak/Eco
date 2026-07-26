import type { FastifyInstance } from "fastify";
import { createNumbatrakFormRequestSchema } from "@platform/shared-types";
import { createForm, serializeForm } from "../lib/forms.js";

export default async function createFormRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/numbatrak/forms",
    { preHandler: app.requireOrgPermission({ numbatrakForms: ["create"] }) },
    async (request, reply) => {
      const body = createNumbatrakFormRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await createForm(db, request.activeOrganizationId!, body);
      return reply.code(201).send(serializeForm(row));
    },
  );
}
