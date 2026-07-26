import type { FastifyInstance } from "fastify";
import { ensureWarehouseAgent, serializeAgent } from "../lib/agents.js";

export default async function ensureWarehouseRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/numbatrak/agents/ensure-warehouse",
    { preHandler: app.requireOrgPermission({ numbatrakAgents: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const row = await ensureWarehouseAgent(db, request.activeOrganizationId!);
      return reply.send(serializeAgent(row));
    },
  );
}
