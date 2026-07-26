import type { FastifyInstance } from "fastify";
import { setAgentActiveRequestSchema } from "@platform/shared-types";
import { parseAgentId, serializeAgent, setAgentActive } from "../lib/agents.js";

export default async function setAgentActiveRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { agentId: string } }>(
    "/org/numbatrak/agents/:agentId/active",
    { preHandler: app.requireOrgPermission({ numbatrakAgents: ["manage"] }) },
    async (request, reply) => {
      const agentId = parseAgentId(request.params.agentId);
      if (agentId === null) {
        return reply.code(400).send({ error: "Invalid agent id" });
      }
      const body = setAgentActiveRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await setAgentActive(db, request.activeOrganizationId!, agentId, body.active);
      if (!row) {
        return reply.code(404).send({ error: "Agent not found" });
      }
      return reply.send(serializeAgent(row));
    },
  );
}
