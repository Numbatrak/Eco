import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { platformAdminAuth } from "../lib/platform-admin-auth.js";

declare module "fastify" {
  interface FastifyInstance {
    /**
     * The only gate any /platform-admin/* route (other than login) may use -
     * every mutating/reading endpoint under that prefix must set this as its
     * preHandler so protection lives at the routing layer, not per-handler.
     */
    requirePlatformAdminAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    platformAdminId?: string;
  }
}

export default fp(async (app) => {
  app.decorate("requirePlatformAdminAuth", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await platformAdminAuth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session) {
      await reply.code(401).send({ error: "Not authenticated" });
      return;
    }
    request.platformAdminId = session.user.id;
  });
});
