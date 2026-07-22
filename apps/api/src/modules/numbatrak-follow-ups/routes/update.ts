import type { FastifyInstance } from "fastify";
import { updateNumbatrakFollowUpRequestSchema } from "@platform/shared-types";
import { updateFollowUp } from "../lib/follow-ups.js";

export default async function updateFollowUpRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { followUpId: string } }>(
    "/org/numbatrak/follow-ups/:followUpId",
    { preHandler: app.requireOrgPermission({ numbatrakFollowUps: ["update"] }) },
    async (request, reply) => {
      const body = updateNumbatrakFollowUpRequestSchema.parse(request.body);
      const db = app.getDb();
      const id = Number(request.params.followUpId);
      let followUp;
      try {
        followUp = await updateFollowUp(db, request.activeOrganizationId!, id, body);
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "Update failed" });
      }
      if (!followUp) {
        return reply.code(404).send({ error: "Follow-up not found" });
      }
      return reply.send(followUp);
    },
  );
}
