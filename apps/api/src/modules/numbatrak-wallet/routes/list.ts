import type { FastifyInstance } from "fastify";
import { fetchRemittanceLines } from "../lib/wallet.js";

export default async function listRemittanceLinesRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/wallet/remittance-lines",
    { preHandler: app.requireOrgPermission({ numbatrakWallet: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const lines = await fetchRemittanceLines(db, request.activeOrganizationId!);
      return reply.send({ lines });
    },
  );
}
