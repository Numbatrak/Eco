import type { FastifyInstance } from "fastify";
import { createNumbatrakFollowUpRequestSchema } from "@platform/shared-types";
import { createFollowUp } from "../lib/follow-ups.js";

export default async function createFollowUpRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/numbatrak/follow-ups",
    { preHandler: app.requireOrgPermission({ numbatrakFollowUps: ["create"] }) },
    async (request, reply) => {
      const body = createNumbatrakFollowUpRequestSchema.parse(request.body);
      const db = app.getDb();
      let followUp;
      try {
        followUp = await createFollowUp(db, request.activeOrganizationId!, body);
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "Create failed" });
      }
      return reply.code(201).send(followUp);
    },
  );
}
