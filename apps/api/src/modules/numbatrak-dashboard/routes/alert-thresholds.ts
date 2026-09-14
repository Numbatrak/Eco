import type { FastifyInstance } from "fastify";
import { updateNumbatrakDashboardAlertThresholdsRequestSchema } from "@platform/shared-types";
import { getOrCreateAlertThresholds, updateAlertThresholds } from "../lib/alert-thresholds.js";

export default async function dashboardAlertThresholdsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/dashboard/alert-thresholds",
    { preHandler: app.requireOrgPermission({ numbatrakDashboard: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const thresholds = await getOrCreateAlertThresholds(db, organizationId);
      return reply.send(thresholds);
    },
  );

  app.patch(
    "/org/numbatrak/dashboard/alert-thresholds",
    { preHandler: app.requireOrgPermission({ numbatrakDashboard: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = updateNumbatrakDashboardAlertThresholdsRequestSchema.parse(request.body);
      const thresholds = await updateAlertThresholds(db, organizationId, body);
      return reply.send(thresholds);
    },
  );
}
