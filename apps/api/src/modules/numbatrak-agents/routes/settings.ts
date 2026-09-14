import type { FastifyInstance } from "fastify";
import { updateNumbatrakDeliveryAgentSettingsRequestSchema } from "@platform/shared-types";
import { getOrCreateDeliveryAgentSettings, updateDeliveryAgentSettings } from "../lib/delivery-agent-settings.js";

export default async function deliveryAgentSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/agents/settings",
    { preHandler: app.requireOrgPermission({ numbatrakAgents: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const settings = await getOrCreateDeliveryAgentSettings(db, organizationId);
      return reply.send(settings);
    },
  );

  app.patch(
    "/org/numbatrak/agents/settings",
    { preHandler: app.requireOrgPermission({ numbatrakAgents: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = updateNumbatrakDeliveryAgentSettingsRequestSchema.parse(request.body);
      const settings = await updateDeliveryAgentSettings(db, organizationId, body);
      return reply.send(settings);
    },
  );
}
