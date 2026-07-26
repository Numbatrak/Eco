import type { FastifyInstance } from "fastify";
import { fetchFilterOptions } from "../lib/filter-options.js";

export default async function dashboardFilterOptionsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/dashboard/filter-options",
    { preHandler: app.requireOrgPermission({ numbatrakDashboard: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const options = await fetchFilterOptions(db, request.activeOrganizationId!);
      return reply.send(options);
    },
  );
}
