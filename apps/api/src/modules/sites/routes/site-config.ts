import type { FastifyInstance } from "fastify";
import { siteConfigSchema } from "@platform/shared-types";
import { ensureTenantSiteConfig, findSiteConfigByTenant, publishSite, saveSiteConfig } from "../lib/site-store.js";

export default async function siteConfigRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/site-config",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const tenantId = request.activeOrganizationId!;
      await ensureTenantSiteConfig(db, tenantId);
      const config = await findSiteConfigByTenant(db, tenantId);
      return reply.send(config);
    },
  );

  app.put(
    "/org/site-config",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const body = siteConfigSchema.parse(request.body);
      const db = app.getDb();
      const tenantId = request.activeOrganizationId!;
      await ensureTenantSiteConfig(db, tenantId);
      await saveSiteConfig(db, tenantId, body);
      return reply.code(204).send();
    },
  );

  app.post(
    "/org/site-config/publish",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const tenantId = request.activeOrganizationId!;
      await ensureTenantSiteConfig(db, tenantId);
      await publishSite(db, tenantId);
      return reply.code(204).send();
    },
  );
}
