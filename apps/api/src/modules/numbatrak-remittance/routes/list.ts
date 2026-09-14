import type { FastifyInstance } from "fastify";
import { fetchRemittanceLines } from "../lib/remittance.js";

export default async function listRemittanceLinesRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/remittance/lines",
    { preHandler: app.requireOrgPermission({ numbatrakRemittance: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const lines = await fetchRemittanceLines(db, request.activeOrganizationId!);
      return reply.send({ lines });
    },
  );
}
