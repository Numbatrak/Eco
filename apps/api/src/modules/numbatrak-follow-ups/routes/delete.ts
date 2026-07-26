import type { FastifyInstance } from "fastify";
import { removeFollowUp } from "../lib/follow-ups.js";

export default async function deleteFollowUpRoutes(app: FastifyInstance): Promise<void> {
  app.delete<{ Params: { followUpId: string } }>(
    "/org/numbatrak/follow-ups/:followUpId",
    { preHandler: app.requireOrgPermission({ numbatrakFollowUps: ["delete"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const id = Number(request.params.followUpId);
      const deleted = await removeFollowUp(db, request.activeOrganizationId!, id);
      if (!deleted) {
        return reply.code(404).send({ error: "Follow-up not found" });
      }
      return reply.code(204).send();
    },
  );
}
