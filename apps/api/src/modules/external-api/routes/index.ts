import type { FastifyInstance } from "fastify";
import { listCustomers } from "../../numbatrak-crm/lib/crm.js";

/**
 * External API, authenticated via a developer API key (see
 * modules/numbatrak-settings/lib/api-keys.ts) rather than a browser
 * session - proves the key → org resolution works end to end. Read-only and
 * deliberately small; extend with more resources as external integrations
 * need them.
 */
export default async function externalApiRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/customers",
    { preHandler: app.requireApiKeyAuth() },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const customers = await listCustomers(db, organizationId);
      return reply.send({ customers });
    },
  );
}
