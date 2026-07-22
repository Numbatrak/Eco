import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { addNumbatrakWalletNetOffRequestSchema } from "@platform/shared-types";
import { auth } from "../../../lib/auth.js";
import { addNetOff } from "../lib/net-off.js";

export default async function netOffRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/numbatrak/wallet/remittance-lines/net-off",
    { preHandler: app.requireOrgPermission({ numbatrakWallet: ["manage"] }) },
    async (request, reply) => {
      const body = addNumbatrakWalletNetOffRequestSchema.parse(request.body);
      const db = app.getDb();
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) {
        return reply.code(401).send({ error: "Not authenticated" });
      }

      let line;
      try {
        line = await addNetOff(
          db,
          request.activeOrganizationId!,
          body.agentId,
          body.remittanceDate,
          body.amount,
          session.user.id,
          body.note,
        );
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "Net-off failed" });
      }
      return reply.send(line);
    },
  );
}
