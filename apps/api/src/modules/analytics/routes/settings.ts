import type { FastifyInstance } from "fastify";
import { analyticsSettingsRequestSchema, type AnalyticsSettingsResponse } from "@platform/shared-types";
import {
  findAnalyticsSettings,
  serializeAnalyticsSettings,
  upsertAnalyticsSettings,
} from "../lib/analytics-settings-store.js";

export default async function analyticsSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/analytics-settings",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const row = await findAnalyticsSettings(db, request.activeOrganizationId!);
      const response: AnalyticsSettingsResponse = serializeAnalyticsSettings(row);
      return reply.send(response);
    },
  );

  app.put(
    "/org/analytics-settings",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const body = analyticsSettingsRequestSchema.parse(request.body);
      const db = app.getDb();
      await upsertAnalyticsSettings(db, request.activeOrganizationId!, body);
      const row = await findAnalyticsSettings(db, request.activeOrganizationId!);
      const response: AnalyticsSettingsResponse = serializeAnalyticsSettings(row);
      return reply.send(response);
    },
  );
}
