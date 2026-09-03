import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq } from "drizzle-orm";
import { member } from "@platform/db";
import { auth } from "../../../lib/auth.js";
import { resolveCallerStaffScope } from "../../numbatrak-staff/lib/staff.js";
import {
  getOrCreateSettings,
  updateSettings,
  listStrikes,
  issueStrikes,
  clearStrike,
} from "../lib/strikes.js";

export default async function numbatrakStrikesRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/strikes/settings",
    { preHandler: app.requireOrgPermission({ numbatrakStrikes: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const settings = await getOrCreateSettings(db, organizationId);
      return reply.send(settings);
    },
  );

  app.patch(
    "/org/numbatrak/strikes/settings",
    { preHandler: app.requireOrgPermission({ numbatrakStrikes: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = request.body as { threshold?: number; thresholdPeriod?: string; consequence?: string };
      const settings = await updateSettings(db, organizationId, body);
      return reply.send(settings);
    },
  );

  app.get(
    "/org/numbatrak/strikes",
    { preHandler: app.requireOrgPermission({ numbatrakStrikes: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) return reply.status(401).send({ error: "Unauthorized" });
      const scope = await resolveCallerStaffScope(db, organizationId, session.user.id);
      const strikes = await listStrikes(db, organizationId, scope);
      return reply.send({ strikes });
    },
  );

  app.post(
    "/org/numbatrak/strikes",
    { preHandler: app.requireOrgPermission({ numbatrakStrikes: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) return reply.status(401).send({ error: "Unauthorized" });
      const { staffIds, reason } = request.body as { staffIds: string[]; reason: string };
      const scope = await resolveCallerStaffScope(db, organizationId, session.user.id);
      try {
        const strikes = await issueStrikes(db, request.log, organizationId, staffIds, reason, session.user.id, scope);
        return reply.status(201).send({ strikes });
      } catch (err) {
        return reply.status(400).send({ error: err instanceof Error ? err.message : "Issue strikes failed" });
      }
    },
  );

  app.delete(
    "/org/numbatrak/strikes/:strikeId",
    { preHandler: app.requireOrgPermission({ numbatrakStrikes: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      // "Admins issue and clear any" (LOCKED RULE) - clearing is admin/owner
      // only, unlike issuing which managers can also do for their team.
      const [membership] = await db
        .select({ role: member.role })
        .from(member)
        .where(and(eq(member.organizationId, organizationId), eq(member.userId, session.user.id)))
        .limit(1);
      if (!membership || !["owner", "admin"].includes(membership.role)) {
        return reply.status(403).send({ error: "Only an admin or owner can clear a strike." });
      }

      const { strikeId } = request.params as { strikeId: string };
      const strike = await clearStrike(db, organizationId, strikeId, session.user.id);
      if (!strike) return reply.status(404).send({ error: "Strike not found" });
      return reply.send(strike);
    },
  );
}
