import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import { resolveApiKey } from "../modules/numbatrak-settings/lib/api-keys.js";

declare module "fastify" {
  interface FastifyInstance {
    /**
     * Gates an external (non-browser-session) route on a valid
     * `Authorization: Bearer <api key>` header, resolving the key to its
     * owning organization exactly like requireOrgPermission resolves a
     * session to one - request.activeOrganizationId is set the same way,
     * so downstream handlers don't need to know which auth path was used.
     */
    requireApiKeyAuth: () => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (app) => {
  app.decorate("requireApiKeyAuth", () => {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const header = request.headers.authorization;
      const key = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
      if (!key) {
        await reply.code(401).send({ error: "Missing Authorization: Bearer <api key> header" });
        return;
      }

      const resolved = await resolveApiKey(app.getDb(), key);
      if (!resolved) {
        await reply.code(401).send({ error: "Invalid or revoked API key" });
        return;
      }

      request.activeOrganizationId = resolved.organizationId;
    };
  });
});
