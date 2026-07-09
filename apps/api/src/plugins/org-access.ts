import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";

declare module "fastify" {
  interface FastifyInstance {
    /**
     * Gates a route on the caller's active organization having the given
     * access-control statement/actions (see ../lib/access-control.ts).
     */
    requireOrgPermission: (
      permissions: Record<string, string[]>,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /**
     * Narrower check for routes any active member (regardless of role) may
     * read - there's no generic "member" role left to check against in the
     * new permission-only model, so this just confirms org membership.
     */
    requireOrgMembership: () => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    activeOrganizationId?: string;
  }
}

export default fp(async (app) => {
  app.decorate("requireOrgPermission", (permissions: Record<string, string[]>) => {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const headers = fromNodeHeaders(request.headers);
      const session = await auth.api.getSession({ headers });
      if (!session) {
        await reply.code(401).send({ error: "Not authenticated" });
        return;
      }
      const organizationId = session.session.activeOrganizationId;
      if (!organizationId) {
        await reply.code(400).send({ error: "No active organization selected" });
        return;
      }
      const result = await auth.api.hasPermission({ headers, body: { organizationId, permissions } });
      if (!result.success) {
        await reply.code(403).send({ error: "Missing required permission" });
        return;
      }
      request.activeOrganizationId = organizationId;
    };
  });

  app.decorate("requireOrgMembership", () => {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const headers = fromNodeHeaders(request.headers);
      const session = await auth.api.getSession({ headers });
      if (!session) {
        await reply.code(401).send({ error: "Not authenticated" });
        return;
      }
      const organizationId = session.session.activeOrganizationId;
      if (!organizationId) {
        await reply.code(400).send({ error: "No active organization selected" });
        return;
      }
      try {
        // Throws (rather than returning null) if the caller isn't a member.
        await auth.api.getActiveMember({ headers });
      } catch {
        await reply.code(403).send({ error: "Not a member of this organization" });
        return;
      }
      request.activeOrganizationId = organizationId;
    };
  });
});
