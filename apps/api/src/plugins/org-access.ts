import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { eq } from "drizzle-orm";
import { organization, type Database } from "@platform/db";
import { auth } from "../lib/auth.js";
import { recordUserActivity } from "../modules/platform-billing/lib/metrics/activity-store.js";

/**
 * Best-effort "user was active today" record for DAU/MAU. Never allowed to
 * break the request it rides on — any failure (including no REDIS/DB hiccup)
 * is swallowed. Called from the shared auth decorators, so any authenticated
 * member hitting an /org/* route counts as active.
 */
async function recordActivitySafe(
  db: Database,
  userId: string,
  organizationId: string,
): Promise<void> {
  try {
    await recordUserActivity(db, userId, organizationId, new Date());
  } catch {
    // Activity tracking is non-critical; ignore.
  }
}

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

/**
 * Single choke point for tenant suspension: both requireOrgPermission and
 * requireOrgMembership call this right after resolving the active org, so a
 * suspended tenant's team is locked out of every /org/* route regardless of
 * which helper the route uses. Returns true (and has already replied) if
 * suspended - callers should return immediately in that case.
 */
async function rejectIfSuspended(
  db: Database,
  organizationId: string,
  reply: FastifyReply,
): Promise<boolean> {
  const [row] = await db
    .select({ status: organization.status })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  if (row?.status === "suspended") {
    await reply.code(403).send({
      error: "organization_suspended",
      message: "Your account has been suspended, contact support.",
    });
    return true;
  }
  return false;
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
      if (await rejectIfSuspended(app.getDb(), organizationId, reply)) {
        return;
      }
      const result = await auth.api.hasPermission({ headers, body: { organizationId, permissions } });
      if (!result.success) {
        await reply.code(403).send({ error: "Missing required permission" });
        return;
      }
      request.activeOrganizationId = organizationId;
      await recordActivitySafe(app.getDb(), session.user.id, organizationId);
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
      if (await rejectIfSuspended(app.getDb(), organizationId, reply)) {
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
      await recordActivitySafe(app.getDb(), session.user.id, organizationId);
    };
  });
});
