import type { FastifyInstance } from "fastify";
import { deleteAgent, parseAgentId } from "../lib/agents.js";

export default async function deleteAgentRoutes(app: FastifyInstance): Promise<void> {
  app.delete<{ Params: { agentId: string } }>(
    "/org/numbatrak/agents/:agentId",
    { preHandler: app.requireOrgPermission({ numbatrakAgents: ["manage"] }) },
    async (request, reply) => {
      const agentId = parseAgentId(request.params.agentId);
      if (agentId === null) {
        return reply.code(400).send({ error: "Invalid agent id" });
      }
      const db = app.getDb();
      const deleted = await deleteAgent(db, request.activeOrganizationId!, agentId);
      if (!deleted) {
        return reply.code(404).send({ error: "Agent not found" });
      }
      return reply.code(204).send();
    },
  );
}
