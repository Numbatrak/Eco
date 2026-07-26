import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../../lib/auth.js";
import {
  getOrCreateSettings,
  updateSettings,
  listTiers,
  createTier,
  deleteTier,
  listStars,
  awardStar,
  getLeaderboard,
} from "../lib/stars.js";

export default async function numbatrakStarsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/stars/settings",
    { preHandler: app.requireOrgPermission({ numbatrakStars: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const settings = await getOrCreateSettings(db, organizationId);
      return reply.send(settings);
    },
  );

  app.patch(
    "/org/numbatrak/stars/settings",
    { preHandler: app.requireOrgPermission({ numbatrakStars: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = request.body as Record<string, unknown>;
      const settings = await updateSettings(db, organizationId, body);
      return reply.send(settings);
    },
  );

  app.get(
    "/org/numbatrak/stars/tiers",
    { preHandler: app.requireOrgPermission({ numbatrakStars: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const tiers = await listTiers(db, organizationId);
      return reply.send({ tiers });
    },
  );

  app.post(
    "/org/numbatrak/stars/tiers",
    { preHandler: app.requireOrgPermission({ numbatrakStars: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = request.body as { name: string; minPoints: number; displayOrder?: number };
      const tier = await createTier(db, organizationId, body);
      return reply.status(201).send(tier);
    },
  );

  app.delete(
    "/org/numbatrak/stars/tiers/:tierId",
    { preHandler: app.requireOrgPermission({ numbatrakStars: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { tierId } = request.params as { tierId: string };
      const ok = await deleteTier(db, organizationId, tierId);
      if (!ok) return reply.status(404).send({ error: "Tier not found" });
      return reply.send({ success: true });
    },
  );

  app.get(
    "/org/numbatrak/stars",
    { preHandler: app.requireOrgPermission({ numbatrakStars: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { month } = request.query as { month?: string };
      const stars = await listStars(db, organizationId, month);
      return reply.send({ stars });
    },
  );

  app.post(
    "/org/numbatrak/stars",
    { preHandler: app.requireOrgPermission({ numbatrakStars: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) return reply.status(401).send({ error: "Unauthorized" });
      const { staffId, points, reason } = request.body as { staffId: string; points?: number; reason: string };
      const star = await awardStar(db, organizationId, staffId, points ?? 1, reason, session.user.id);
      return reply.status(201).send(star);
    },
  );

  app.get(
    "/org/numbatrak/stars/leaderboard",
    { preHandler: app.requireOrgPermission({ numbatrakStars: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { month } = request.query as { month?: string };
      const leaderboard = await getLeaderboard(db, organizationId, month);
      return reply.send({ leaderboard });
    },
  );
}
