import type { FastifyInstance } from "fastify";
import { deliverySettingsRequestSchema, type DeliverySettingsResponse } from "@platform/shared-types";
import {
  findDeliverySettings,
  serializeDeliverySettings,
  upsertDeliverySettings,
} from "../lib/delivery-settings-store.js";

export default async function deliverySettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/delivery-settings",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const row = await findDeliverySettings(db, request.activeOrganizationId!);
      const response: DeliverySettingsResponse = serializeDeliverySettings(row);
      return reply.send(response);
    },
  );

  app.put(
    "/org/delivery-settings",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const body = deliverySettingsRequestSchema.parse(request.body);
      const db = app.getDb();
      await upsertDeliverySettings(db, request.activeOrganizationId!, body);
      const row = await findDeliverySettings(db, request.activeOrganizationId!);
      const response: DeliverySettingsResponse = serializeDeliverySettings(row);
      return reply.send(response);
    },
  );
}
