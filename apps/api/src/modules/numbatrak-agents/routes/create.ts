import type { FastifyInstance } from "fastify";
import { createAgentRequestSchema } from "@platform/shared-types";
import { createAgent, serializeAgent } from "../lib/agents.js";

export default async function createAgentRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/numbatrak/agents",
    { preHandler: app.requireOrgPermission({ numbatrakAgents: ["manage"] }) },
    async (request, reply) => {
      const body = createAgentRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await createAgent(db, request.activeOrganizationId!, body);
      return reply.code(201).send(serializeAgent(row));
    },
  );
}
