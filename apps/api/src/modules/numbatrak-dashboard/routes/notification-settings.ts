import type { FastifyInstance } from "fastify";
import { updateNumbatrakNotificationSettingsRequestSchema } from "@platform/shared-types";
import { getOrCreateNotificationSettings, updateNotificationSettings } from "../lib/notification-settings.js";

export default async function notificationSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/dashboard/notification-settings",
    { preHandler: app.requireOrgPermission({ numbatrakDashboard: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const settings = await getOrCreateNotificationSettings(db, organizationId);
      return reply.send(settings);
    },
  );

  app.patch(
    "/org/numbatrak/dashboard/notification-settings",
    { preHandler: app.requireOrgPermission({ numbatrakDashboard: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = updateNumbatrakNotificationSettingsRequestSchema.parse(request.body);
      const settings = await updateNotificationSettings(db, organizationId, body);
      return reply.send(settings);
    },
  );
}
