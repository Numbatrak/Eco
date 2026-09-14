import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { recordNumbatrakRemittanceRequestSchema } from "@platform/shared-types";
import { auth } from "../../../lib/auth.js";
import { recordRemittance } from "../lib/remittance.js";

export default async function recordRemittanceRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/numbatrak/remittance/lines/record",
    { preHandler: app.requireOrgPermission({ numbatrakRemittance: ["manage"] }) },
    async (request, reply) => {
      const body = recordNumbatrakRemittanceRequestSchema.parse(request.body);
      const db = app.getDb();
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) {
        return reply.code(401).send({ error: "Not authenticated" });
      }

      let line;
      try {
        line = await recordRemittance(
          db,
          request.log,
          request.activeOrganizationId!,
          body.agentId,
          body.remittanceDate,
          body.actualAmount,
          session.user.id,
        );
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "Record remittance failed" });
      }
      return reply.send(line);
    },
  );
}
