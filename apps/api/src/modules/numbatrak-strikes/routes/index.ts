import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../../lib/auth.js";
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
      const strikes = await listStrikes(db, organizationId);
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
      const strikes = await issueStrikes(db, organizationId, staffIds, reason, session.user.id);
      return reply.status(201).send({ strikes });
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
      const { strikeId } = request.params as { strikeId: string };
      const strike = await clearStrike(db, organizationId, strikeId, session.user.id);
      if (!strike) return reply.status(404).send({ error: "Strike not found" });
      return reply.send(strike);
    },
  );
}
