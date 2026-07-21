import type { FastifyInstance } from "fastify";
import { updateAgentRequestSchema } from "@platform/shared-types";
import { parseAgentId, serializeAgent, updateAgent } from "../lib/agents.js";

export default async function updateAgentRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { agentId: string } }>(
    "/org/numbatrak/agents/:agentId",
    { preHandler: app.requireOrgPermission({ numbatrakAgents: ["manage"] }) },
    async (request, reply) => {
      const agentId = parseAgentId(request.params.agentId);
      if (agentId === null) {
        return reply.code(400).send({ error: "Invalid agent id" });
      }
      const body = updateAgentRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await updateAgent(db, request.activeOrganizationId!, agentId, body);
      if (!row) {
        return reply.code(404).send({ error: "Agent not found" });
      }
      return reply.send(serializeAgent(row));
    },
  );
}
