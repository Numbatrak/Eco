import type { FastifyInstance } from "fastify";
import { updateNumbatrakInventorySettingsRequestSchema } from "@platform/shared-types";
import { getOrCreateInventorySettings, updateInventorySettings } from "../lib/inventory-settings.js";

export default async function inventorySettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/inventory/settings",
    { preHandler: app.requireOrgPermission({ numbatrakInventory: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const settings = await getOrCreateInventorySettings(db, organizationId);
      return reply.send(settings);
    },
  );

  app.patch(
    "/org/numbatrak/inventory/settings",
    { preHandler: app.requireOrgPermission({ numbatrakInventory: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = updateNumbatrakInventorySettingsRequestSchema.parse(request.body);
      const settings = await updateInventorySettings(db, organizationId, body);
      return reply.send(settings);
    },
  );
}
