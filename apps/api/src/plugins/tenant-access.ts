import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  findTenantMembership,
  memberHasPermission,
  type TenantMembership,
} from "../modules/permissions/lib/membership.js";
import type { PermissionKey, TenantMemberRole } from "../modules/permissions/lib/permissions.js";

declare module "fastify" {
  interface FastifyInstance {
    requireTenantPermission: (
      key: PermissionKey,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireTenantRole: (
      roles: TenantMemberRole[],
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    tenantMembership?: TenantMembership;
  }
}

function tenantIdFromParams(request: FastifyRequest): string | undefined {
  const params = request.params as { tenantId?: string };
  return params.tenantId;
}

export default fp(async (app) => {
  app.decorate("requireTenantPermission", (key: PermissionKey) => {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const tenantId = tenantIdFromParams(request);
      if (!tenantId) {
        await reply.code(400).send({ error: "Missing tenantId" });
        return;
      }
      const db = app.getDb();
      const membership = await findTenantMembership(db, tenantId, request.userId);
      if (!membership) {
        await reply.code(403).send({ error: "Not a member of this tenant" });
        return;
      }
      const allowed = await memberHasPermission(db, membership.tenantMemberId, key);
      if (!allowed) {
        await reply.code(403).send({ error: "Missing required permission" });
        return;
      }
      request.tenantMembership = membership;
    };
  });

  app.decorate("requireTenantRole", (roles: TenantMemberRole[]) => {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const tenantId = tenantIdFromParams(request);
      if (!tenantId) {
        await reply.code(400).send({ error: "Missing tenantId" });
        return;
      }
      const db = app.getDb();
      const membership = await findTenantMembership(db, tenantId, request.userId);
      if (!membership || !roles.includes(membership.role)) {
        await reply.code(403).send({ error: "Insufficient role for this tenant" });
        return;
      }
      request.tenantMembership = membership;
    };
  });
});
