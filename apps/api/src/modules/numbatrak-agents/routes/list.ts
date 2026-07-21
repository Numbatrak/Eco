import type { FastifyInstance } from "fastify";
import { listAgentsForOrg, serializeAgent } from "../lib/agents.js";

export default async function listAgentsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/agents",
    { preHandler: app.requireOrgPermission({ numbatrakAgents: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const rows = await listAgentsForOrg(db, request.activeOrganizationId!);
      return reply.send({ agents: rows.map(serializeAgent) });
    },
  );
}
