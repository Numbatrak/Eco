import type { FastifyInstance } from "fastify";
import { getSubscriptionForOrg, getAvailablePlans } from "../lib/settings.js";

export default async function numbatrakSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/settings/subscription",
    { preHandler: app.requireOrgMembership() },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const subscription = await getSubscriptionForOrg(db, organizationId);
      return reply.send({ subscription });
    },
  );

  app.get(
    "/org/numbatrak/settings/plans",
    { preHandler: app.requireOrgMembership() },
    async (request, reply) => {
      const db = app.getDb();
      const plans = await getAvailablePlans(db);
      return reply.send({ plans });
    },
  );
}
